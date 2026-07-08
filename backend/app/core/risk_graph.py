from langgraph.graph import StateGraph, END
from app.core.precedent_node import attach_precedents_node
from app.core.risk_agent import RiskReviewState
from app.core.risk_agent import (
    assess_clauses_node,
    gather_context_node,
    reassess_with_context_node,
    compile_final_report_node,
)
def needs_context_check(state: dict) -> str:
    return "gather_context" if state["ambiguous_queue"] else "compile_report"
graph = StateGraph(RiskReviewState)
graph.add_node("assess", assess_clauses_node)
graph.add_node("gather_context", gather_context_node)
graph.add_node("reassess", reassess_with_context_node)
graph.add_node("compile_report", compile_final_report_node)
graph.add_node("attach_precedents", attach_precedents_node)

graph.set_entry_point("assess")
graph.add_conditional_edges("assess", needs_context_check, {
    "gather_context": "gather_context",
    "compile_report": "compile_report",
})
graph.add_edge("gather_context", "reassess")
graph.add_edge("reassess", "compile_report")
graph.add_edge("compile_report", "attach_precedents")
graph.add_edge("attach_precedents", END)
risk_review_graph = graph.compile()