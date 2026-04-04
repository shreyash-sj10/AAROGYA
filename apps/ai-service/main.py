from fastapi import FastAPI

from api.profile import router as profile_router
from api.explain import router as explain_router
from api.feedback import router as feedback_router
from api.rag_endpoint import router as rag_router
from api.prakriti import router as prakriti_router
from api.parse import router as parse_router
from core.llm_wrapper import llm_health_status


app = FastAPI(title="AYUDIET Controlled AI Service")
app.include_router(profile_router)
app.include_router(explain_router)
app.include_router(feedback_router)
app.include_router(rag_router)
app.include_router(prakriti_router)
app.include_router(parse_router)


@app.get("/health")
def health():
    llm_status = llm_health_status()
    overall_ok = bool(llm_status.get("ok"))
    return {
        "status": "ok" if overall_ok else "degraded",
        "checks": {
            "llm": llm_status,
        },
    }
