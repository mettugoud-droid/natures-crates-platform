"""
Product Analysis Workflow using LangGraph
Analyzes products for market fit, white-label potential, and competitive positioning.
"""

from typing import TypedDict, Annotated, Sequence
from langgraph.graph import Graph, StateGraph, END
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
import json
import os


class ProductState(TypedDict):
    product_id: str
    product_name: str
    category: str
    price: float
    monthly_sales: int
    rating: float
    reviews: int
    competition: int
    # Analysis results
    market_analysis: str
    white_label_score: int
    risks: list[str]
    improvements: list[str]
    recommendation: str
    completed_steps: list[str]


def create_product_analysis_graph():
    """Create the LangGraph workflow for product analysis."""
    
    llm = ChatAnthropic(
        model=os.getenv("AI_DEFAULT_MODEL", "claude-sonnet-4-20250514"),
        api_key=os.getenv("ANTHROPIC_API_KEY", ""),
    )
    
    def analyze_market(state: ProductState) -> ProductState:
        """Step 1: Analyze market demand and trends."""
        prompt = f"""Analyze the market potential for this product:
        Product: {state['product_name']}
        Category: {state['category']}
        Price: INR {state['price']}
        Monthly Sales: {state['monthly_sales']}
        Rating: {state['rating']}/5
        Reviews: {state['reviews']}
        Competition Score: {state['competition']}/100
        
        Provide a brief market analysis covering:
        1. Demand assessment
        2. Growth potential
        3. Seasonality factors
        4. Target customer segment for Nature's Crates brand
        
        Keep response to 3-4 sentences."""
        
        response = llm.invoke([
            SystemMessage(content="You are a product research analyst for Nature's Crates, an Indian premium health food brand."),
            HumanMessage(content=prompt),
        ])
        
        state["market_analysis"] = response.content
        state["completed_steps"] = state.get("completed_steps", []) + ["market_analysis"]
        return state
    
    def evaluate_white_label(state: ProductState) -> ProductState:
        """Step 2: Evaluate white-label and private label potential."""
        prompt = f"""Based on this product data, score its white-label/private-label potential (0-100):
        Product: {state['product_name']}
        Category: {state['category']}
        Price: INR {state['price']}
        Monthly Sales: {state['monthly_sales']}
        Competition: {state['competition']}/100
        Market Analysis: {state['market_analysis']}
        
        Consider:
        - Ease of finding manufacturers in India
        - Branding potential under "Nature's Crates"
        - Margin potential
        - Repeat purchase likelihood
        
        Return ONLY a JSON: {{"score": <0-100>, "reasoning": "<brief reason>"}}"""
        
        response = llm.invoke([
            SystemMessage(content="You are a white-label product sourcing expert for Indian markets."),
            HumanMessage(content=prompt),
        ])
        
        try:
            result = json.loads(response.content)
            state["white_label_score"] = result.get("score", 50)
        except (json.JSONDecodeError, TypeError):
            state["white_label_score"] = 50
        
        state["completed_steps"] = state.get("completed_steps", []) + ["white_label_evaluation"]
        return state
    
    def identify_risks(state: ProductState) -> ProductState:
        """Step 3: Identify risks and suggest improvements."""
        prompt = f"""For this product opportunity, identify risks and suggest improvements:
        Product: {state['product_name']}
        Category: {state['category']}
        White-Label Score: {state['white_label_score']}/100
        Competition: {state['competition']}/100
        
        Return JSON: {{
            "risks": ["risk1", "risk2", "risk3"],
            "improvements": ["improvement1", "improvement2", "improvement3"]
        }}"""
        
        response = llm.invoke([
            SystemMessage(content="You are a risk analyst for FMCG product launches in India."),
            HumanMessage(content=prompt),
        ])
        
        try:
            result = json.loads(response.content)
            state["risks"] = result.get("risks", [])
            state["improvements"] = result.get("improvements", [])
        except (json.JSONDecodeError, TypeError):
            state["risks"] = ["Unable to parse risks"]
            state["improvements"] = ["Unable to parse improvements"]
        
        state["completed_steps"] = state.get("completed_steps", []) + ["risk_identification"]
        return state
    
    def generate_recommendation(state: ProductState) -> ProductState:
        """Step 4: Generate final recommendation."""
        score = state["white_label_score"]
        
        if score >= 80:
            recommendation = f"STRONG LAUNCH CANDIDATE. Score: {score}/100. Proceed with manufacturer sourcing immediately."
        elif score >= 60:
            recommendation = f"GOOD OPPORTUNITY. Score: {score}/100. Worth exploring with detailed margin analysis."
        elif score >= 40:
            recommendation = f"MODERATE POTENTIAL. Score: {score}/100. Consider only if manufacturing costs are very low."
        else:
            recommendation = f"SKIP. Score: {score}/100. Not suitable for Nature's Crates at this time."
        
        state["recommendation"] = recommendation
        state["completed_steps"] = state.get("completed_steps", []) + ["recommendation"]
        return state
    
    # Build the graph
    workflow = StateGraph(ProductState)
    
    workflow.add_node("analyze_market", analyze_market)
    workflow.add_node("evaluate_white_label", evaluate_white_label)
    workflow.add_node("identify_risks", identify_risks)
    workflow.add_node("generate_recommendation", generate_recommendation)
    
    workflow.set_entry_point("analyze_market")
    workflow.add_edge("analyze_market", "evaluate_white_label")
    workflow.add_edge("evaluate_white_label", "identify_risks")
    workflow.add_edge("identify_risks", "generate_recommendation")
    workflow.add_edge("generate_recommendation", END)
    
    return workflow.compile()


async def run_product_analysis_workflow():
    """Run the product analysis workflow on pending products."""
    # In production, this would fetch from the database
    # For now, return a status message
    graph = create_product_analysis_graph()
    
    return {
        "status": "ready",
        "workflow": "product_analysis",
        "graph_nodes": ["analyze_market", "evaluate_white_label", "identify_risks", "generate_recommendation"],
    }
