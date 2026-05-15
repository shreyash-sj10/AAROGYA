import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserContextStore } from "@/store/userContext.store";
import type { UserContext } from "@/store/userContext.store";
import { useRunPrakritiAssessment } from "@/services/prakriti/useRunPrakritiAssessment";
import { ProfileStep, validateProfileStep } from "@/app/onboarding/steps/ProfileStep";
import { HealthStep, validateHealthStep } from "@/app/onboarding/steps/HealthStep";
import { SymptomsStep, validateSymptomsStep } from "@/app/onboarding/steps/SymptomsStep";
import { GoalsStep, validateGoalsStep } from "@/app/onboarding/steps/GoalsStep";
import { ConstraintsStep, validateConstraintsStep } from "@/app/onboarding/steps/ConstraintsStep";
import { PrakritiQuestionnaireStep } from "@/app/onboarding/steps/PrakritiQuestionnaireStep";
import { fetchUserContext, getAuthToken, persistUserContext, toClientError } from "@/services/auth/auth.api";

const STEP_CONFIG = [
  { key: "profile", label: "Profile", validate: validateProfileStep },
  { key: "health", label: "Health", validate: validateHealthStep },
  { key: "symptoms", label: "Symptoms", validate: validateSymptomsStep },
  { key: "goals", label: "Goals", validate: validateGoalsStep },
  { key: "constraints", label: "Dietary constraints", validate: validateConstraintsStep },
] as const;

type StepKey = (typeof STEP_CONFIG)[number]["key"];
type DoshaKey = "vata" | "pitta" | "kapha";

const DOSHA_COPY: Record<DoshaKey, { title: string; description: string; color: string }> = {
  vata: {
    title: "Vata",
    description: "You tend toward creative, quick, and light patterns when balanced.",
    color: "#059669",
  },
  pitta: {
    title: "Pitta",
    description: "You tend toward focused, driven, and intense patterns when balanced.",
    color: "#0284c7",
  },
  kapha: {
    title: "Kapha",
    description: "You tend toward steady, grounded, and calm patterns when balanced.",
    color: "#d97706",
  },
};

function validateUserContext(context: UserContext): boolean {
  return STEP_CONFIG.every((step) => step.validate(context));
}

function renderStep(step: StepKey, showErrors: boolean) {
  if (step === "profile") {
    return <ProfileStep showErrors={showErrors} />;
  }

  if (step === "health") {
    return <HealthStep showErrors={showErrors} />;
  }

  if (step === "symptoms") {
    return <SymptomsStep showErrors={showErrors} />;
  }

  if (step === "goals") {
    return <GoalsStep showErrors={showErrors} />;
  }

  return <ConstraintsStep showErrors={showErrors} />;
}

function getDominantDosha(prakriti: NonNullable<UserContext["prakriti"]>): DoshaKey {
  const entries: Array<{ key: DoshaKey; value: number }> = [
    { key: "vata", value: prakriti.vata },
    { key: "pitta", value: prakriti.pitta },
    { key: "kapha", value: prakriti.kapha },
  ];

  entries.sort((a, b) => b.value - a.value);
  return entries[0].key;
}

function toPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const context = useUserContextStore((s) => s.userContext);
  const setUserContext = useUserContextStore((s) => s.setUserContext);

  const [currentStep, setCurrentStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showErrorsByStep, setShowErrorsByStep] = useState<Record<number, boolean>>({});
  const [prakritiCompletedInline, setPrakritiCompletedInline] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { isPrakritiAssessmentOpen, runPrakritiAssessment, closePrakritiAssessment } = useRunPrakritiAssessment();

  const stepMeta = STEP_CONFIG[currentStep];
  const totalSteps = STEP_CONFIG.length;
  const isLastStep = currentStep === totalSteps - 1;

  const isCurrentStepValid = useMemo(() => stepMeta.validate(context), [context, stepMeta]);
  const canSubmit = isCurrentStepValid && Boolean(context.prakriti);
  const showCurrentStepErrors = Boolean(showErrorsByStep[currentStep]);
  const prakritiResult = context.prakriti;
  const assessmentLocked = Boolean(prakritiResult);

  const dominantDosha = useMemo(() => {
    if (!prakritiResult) {
      return null;
    }
    return getDominantDosha(prakritiResult);
  }, [prakritiResult]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const result = await fetchUserContext(token);
        if (!cancelled && result.context) {
          navigate("/app/dashboard", { replace: true });
        }
      } catch (error) {
        console.error(error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);
  const chartStyle = useMemo(() => {
    if (!prakritiResult) {
      return undefined;
    }

    const vataDeg = prakritiResult.vata * 360;
    const pittaDeg = prakritiResult.pitta * 360;
    const vataEnd = vataDeg;
    const pittaEnd = vataDeg + pittaDeg;

    return {
      background: `conic-gradient(${DOSHA_COPY.vata.color} 0deg ${vataEnd}deg, ${DOSHA_COPY.pitta.color} ${vataEnd}deg ${pittaEnd}deg, ${DOSHA_COPY.kapha.color} ${pittaEnd}deg 360deg)`,
    };
  }, [prakritiResult]);

  const goBack = () => {
    setSubmitError(null);
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  const goNext = () => {
    setSubmitError(null);

    if (!isCurrentStepValid) {
      setShowErrorsByStep((prev) => ({ ...prev, [currentStep]: true }));
      return;
    }

    setShowErrorsByStep((prev) => ({ ...prev, [currentStep]: false }));
    setCurrentStep((prev) => Math.min(totalSteps - 1, prev + 1));
  };

  const finish = async () => {
    setSubmitError(null);

    if (!isCurrentStepValid) {
      setShowErrorsByStep((prev) => ({ ...prev, [currentStep]: true }));
      return;
    }

    if (!validateUserContext(context)) {
      setShowErrorsByStep({
        0: true,
        1: true,
        2: true,
        3: true,
        4: true,
      });
      setSubmitError("Please complete all required fields before continuing.");
      return;
    }

    if (!prakritiResult) {
      setSubmitError("Prakriti assessment is required before generating your plan");
      return;
    }

    const token = getAuthToken();
    if (!token) {
      const error = toClientError(new Error("Authentication token not found"), "Failed to persist user context");
      setSubmitError(error.message);
      console.error(error);
      throw error;
    }

    setIsSubmitting(true);

    try {
      await persistUserContext(token, context);
      setUserContext(context);
      navigate("/app/dashboard");
    } catch (error) {
      const clientError = toClientError(error, "Failed to persist user context");
      setSubmitError(clientError.message);
      console.error(clientError);
      throw clientError;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssessmentComplete = () => {
    setPrakritiCompletedInline(true);
    closePrakritiAssessment();
    setSubmitError(null);
  };

  return (
    <main className="min-h-screen bg-[#F5F1E8] px-6 py-5">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-[#E6E1D8] bg-[#F5F1E8] p-6 shadow-sm">
        <div className="mb-6 border-b border-[#E6E1D8] pb-4">
          <p className="text-sm text-gray-600">
            Step {currentStep + 1} of {totalSteps}
            <span className="text-gray-400"> | </span>
            <span className="font-medium text-[#2F2F2F]">{stepMeta.label}</span>
          </p>
          <h1 className="mt-1 text-lg font-semibold text-[#2F2F2F]">
            Set up your profile
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            This information helps personalize your experience. You can generate a plan later from the dashboard.
          </p>
        </div>

        <div className="flex flex-col gap-5">{renderStep(stepMeta.key, showCurrentStepErrors)}</div>

        {isLastStep && (
          <p className="mt-4 text-sm text-gray-600">
            Prakriti assessment is required before generating your plan
          </p>
        )}

        {(prakritiCompletedInline || context.prakriti) && isLastStep && (
          <p className="mt-2 text-sm font-medium text-[#7A6F4B]" role="status">
            Constitution assessment completed
          </p>
        )}

        {isLastStep && prakritiResult && dominantDosha && chartStyle && (
          <section className="mt-4 overflow-hidden rounded-2xl border border-[#E6E1D8] bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-400">Dosha Profile</p>
            <h3 className="mt-1 text-lg font-semibold text-[#2F2F2F]">
              Dominant Dosha: {DOSHA_COPY[dominantDosha].title}
            </h3>
            <p className="mt-1 text-sm text-gray-600">{DOSHA_COPY[dominantDosha].description}</p>

            <div className="mt-5 grid gap-4 md:grid-cols-[220px_1fr] md:items-center">
              <div className="flex items-center justify-center">
                <div className="relative h-40 w-40 rounded-full p-2 shadow-inner" style={chartStyle}>
                  <div className="absolute inset-3 rounded-full bg-white" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <p className="text-lg font-semibold text-[#2F2F2F]">{toPercent(prakritiResult[dominantDosha])}</p>
                    <p className="text-xs uppercase tracking-wide text-gray-400">{DOSHA_COPY[dominantDosha].title}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {["vata", "pitta", "kapha"].map((key) => {
                  const k = key as DoshaKey;
                  const value = prakritiResult[k];
                  return (
                    <div key={k}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium uppercase tracking-wide text-[#2F2F2F]">{DOSHA_COPY[k].title}</span>
                        <span className="font-semibold text-[#2F2F2F]">{toPercent(value)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#E6E1D8]">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: toPercent(value), backgroundColor: DOSHA_COPY[k].color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {submitError && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {submitError}
          </p>
        )}

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-[#E6E1D8] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={goBack}
            disabled={currentStep === 0}
            className="rounded-xl border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Back
          </button>

          {!isLastStep ? (
            <button
              type="button"
              onClick={goNext}
              disabled={!isCurrentStepValid}
              className="rounded-xl bg-[#7A6F4B] px-5 py-2 text-sm font-semibold text-white transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          ) : (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={runPrakritiAssessment}
                disabled={assessmentLocked}
                className="rounded-xl border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {assessmentLocked ? "Assessment Completed" : "Complete Prakriti Assessment"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void finish();
                }}
                disabled={!canSubmit || isSubmitting}
                className="rounded-xl bg-[#7A6F4B] px-5 py-2 text-sm font-semibold text-white transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Submit
              </button>
            </div>
          )}
        </div>
      </div>

      {isPrakritiAssessmentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-[#E6E1D8] bg-[#F5F1E8] p-6 shadow-sm">
            <PrakritiQuestionnaireStep
              onCompleted={handleAssessmentComplete}
              onCancel={closePrakritiAssessment}
            />
          </div>
        </div>
      )}
    </main>
  );
}







