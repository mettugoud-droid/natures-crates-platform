"""
Nature's Crates - AI Data Pipeline
LangGraph-powered product analysis and opportunity detection
"""

import os
import asyncio
from dotenv import load_dotenv
from workflows.product_analysis import run_product_analysis_workflow
from workflows.opportunity_detection import run_opportunity_workflow
from workflows.daily_pipeline import run_daily_pipeline

load_dotenv()


async def main():
    """Main entry point for the data pipeline."""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python main.py <workflow>")
        print("Available workflows:")
        print("  analyze   - Run product analysis on new products")
        print("  detect    - Run opportunity detection")
        print("  daily     - Run complete daily pipeline")
        print("  all       - Run all workflows sequentially")
        return
    
    workflow = sys.argv[1]
    
    if workflow == "analyze":
        result = await run_product_analysis_workflow()
        print(f"Product analysis complete: {result}")
    elif workflow == "detect":
        result = await run_opportunity_workflow()
        print(f"Opportunity detection complete: {result}")
    elif workflow == "daily":
        result = await run_daily_pipeline()
        print(f"Daily pipeline complete: {result}")
    elif workflow == "all":
        print("Running all workflows...")
        r1 = await run_product_analysis_workflow()
        print(f"1. Product analysis: {r1}")
        r2 = await run_opportunity_workflow()
        print(f"2. Opportunity detection: {r2}")
        r3 = await run_daily_pipeline()
        print(f"3. Daily pipeline: {r3}")
    else:
        print(f"Unknown workflow: {workflow}")


if __name__ == "__main__":
    asyncio.run(main())
