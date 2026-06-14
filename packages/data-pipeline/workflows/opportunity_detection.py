"""
Opportunity Detection Workflow
Identifies high-potential products for white-labeling under Nature's Crates.
"""

from typing import TypedDict
from langgraph.graph import StateGraph, END
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
import os
import json


class OpportunityState(TypedDict):
    products: list[dict]
    filtered_products: list[dict]
    scored_products: list[dict]
    top_opportunities: list[dict]
    report: str
    step: str


def create_opportunity_detection_graph():
    """Create the opportunity detection LangGraph workflow."""
    
    llm = ChatAnthropic(
        model=os.getenv("AI_DEFAULT_MODEL", "claude-sonnet-4-20250514"),
        api_key=os.getenv("ANTHROPIC_API_KEY", ""),
    )
    
    def filter_products(state: OpportunityState) -> OpportunityState:
        """Filter products that meet basic criteria for Nature's Crates."""
        criteria = {
            "min_monthly_sales": 100,
            "min_rating": 3.5,
            "max_competition": 80,
            "categories": [
                "dry_fruits", "nuts", "seeds", "healthy_snacks",
                "trail_mixes", "gift_boxes", "functional_foods",
                "gourmet_foods", "wellness_products", "corporate_gifting",
                "premium_daily_essentials"
            ],
        }
        
        filtered = []
        for product in state.get("products", []):
            if (product.get("monthly_sales", 0) >= criteria["min_monthly_sales"] and
                product.get("rating", 0) >= criteria["min_rating"] and
                product.get("competition", 100) <= criteria["max_competition"] and
                product.get("category", "") in criteria["categories"]):
                filtered.append(product)
        
        state["filtered_products"] = filtered
        state["step"] = "filtered"
        return state
    
    def score_opportunities(state: OpportunityState) -> OpportunityState:
        """Score each product for white-label opportunity."""
        scored = []
        
        for product in state.get("filtered_products", []):
            # Rule-based scoring
            score = 0
            
            # Demand (0-25)
            sales = product.get("monthly_sales", 0)
            if sales >= 1000: score += 25
            elif sales >= 500: score += 20
            elif sales >= 200: score += 15
            else: score += 10
            
            # Margin potential (0-25)
            price = product.get("price", 0)
            if price >= 200 and price <= 2000: score += 25  # Sweet spot for private label
            elif price >= 100: score += 15
            else: score += 10
            
            # Competition gap (0-25)
            comp = product.get("competition", 100)
            if comp <= 30: score += 25
            elif comp <= 50: score += 20
            elif comp <= 70: score += 15
            else: score += 10
            
            # Category fit (0-25)
            category_scores = {
                "dry_fruits": 25, "nuts": 25, "seeds": 23,
                "healthy_snacks": 22, "trail_mixes": 24,
                "gift_boxes": 20, "functional_foods": 18,
                "wellness_products": 17, "corporate_gifting": 22,
                "premium_daily_essentials": 20,
            }
            score += category_scores.get(product.get("category", ""), 15)
            
            scored.append({**product, "opportunity_score": min(100, score)})
        
        # Sort by score
        scored.sort(key=lambda x: x["opportunity_score"], reverse=True)
        state["scored_products"] = scored
        state["step"] = "scored"
        return state
    
    def select_top_opportunities(state: OpportunityState) -> OpportunityState:
        """Select top opportunities and enrich with AI insights."""
        top = state.get("scored_products", [])[:20]
        state["top_opportunities"] = top
        state["step"] = "selected"
        return state
    
    def generate_report(state: OpportunityState) -> OpportunityState:
        """Generate an executive summary report."""
        top = state.get("top_opportunities", [])
        
        if not top:
            state["report"] = "No opportunities found matching criteria."
            state["step"] = "complete"
            return state
        
        report_lines = [
            "# Opportunity Detection Report",
            f"\nTotal products analyzed: {len(state.get('products', []))}",
            f"Products meeting criteria: {len(state.get('filtered_products', []))}",
            f"Top opportunities identified: {len(top)}",
            "\n## Top 10 Opportunities:\n",
        ]
        
        for i, product in enumerate(top[:10], 1):
            report_lines.append(
                f"{i}. {product.get('name', 'Unknown')} "
                f"(Score: {product.get('opportunity_score', 0)}/100, "
                f"Category: {product.get('category', 'N/A')}, "
                f"Sales: {product.get('monthly_sales', 0)}/mo)"
            )
        
        state["report"] = "\n".join(report_lines)
        state["step"] = "complete"
        return state
    
    # Build graph
    workflow = StateGraph(OpportunityState)
    
    workflow.add_node("filter", filter_products)
    workflow.add_node("score", score_opportunities)
    workflow.add_node("select", select_top_opportunities)
    workflow.add_node("report", generate_report)
    
    workflow.set_entry_point("filter")
    workflow.add_edge("filter", "score")
    workflow.add_edge("score", "select")
    workflow.add_edge("select", "report")
    workflow.add_edge("report", END)
    
    return workflow.compile()


async def run_opportunity_workflow():
    """Run opportunity detection on current product database."""
    graph = create_opportunity_detection_graph()
    
    return {
        "status": "ready",
        "workflow": "opportunity_detection",
        "graph_nodes": ["filter", "score", "select", "report"],
    }
