from fastapi import FastAPI

from api.profile import router as profile_router
from api.explain import router as explain_router
from api.feedback import router as feedback_router
from api.rag_endpoint import router as rag_router


app = FastAPI(title="AYUDIET Controlled AI Service")
app.include_router(profile_router)
app.include_router(explain_router)
app.include_router(feedback_router)
app.include_router(rag_router)


@app.get("/health")
def health():
    return {"status": "ok"}
