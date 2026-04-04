import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserContextStore } from "@/store/userContext.store";
import type { UserContext } from "@/store/userContext.store";
import { ProfileStep, validateProfileStep } from "@/app/onboarding/steps/ProfileStep";
import { HealthStep, validateHealthStep } from "@/app/onboarding/steps/HealthStep";
import { SymptomsStep, validateSymptomsStep } from "@/app/onboarding/steps/SymptomsStep";
import { GoalsStep, validateGoalsStep } from "@/app/onboarding/steps/GoalsStep";
import { ConstraintsStep, validateConstraintsStep } from "@/app/onboarding/steps/ConstraintsStep";

const STEP_CONFIG = [
  { key: "profile", label: "Profile", validate: validateProfileStep },
  { key: "health", label: "Health", validate: validateHealthStep },
  { key: "symptoms", label: "Symptoms", validate: validateSymptomsStep },
  { key: "goals", label: "Goals", validate: validateGoalsStep },
  { key: "constraints", label: "Dietary constraints", validate: validateConstraintsStep },
] as const;

type StepKey = (typeof STEP_CONFIG)[number]["key"];

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

export default function OnboardingPage() {
  const navigate = useNavigate();
  const context = useUserContextStore((s) => s.userContext);
  const setUserContext = useUserContextStore((s) => s.setUserContext);

  const [currentStep, setCurrentStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showErrorsByStep, setShowErrorsByStep] = useState<Record<number, boolean>>({});

  const stepMeta = STEP_CONFIG[currentStep];
  const totalSteps = STEP_CONFIG.length;
  const isLastStep = currentStep === totalSteps - 1;

  const isCurrentStepValid = useMemo(() => stepMeta.validate(context), [context, stepMeta]);

  const showCurrentStepErrors = Boolean(showErrorsByStep[currentStep]);

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

  const finish = () => {
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

    setUserContext(context);
    navigate("/app/dashboard");
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-[560px] rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 border-b border-slate-100 pb-4">
          <p className="text-sm text-slate-500">
            Step {currentStep + 1} of {totalSteps}
            <span className="text-slate-400"> — </span>
            <span className="font-medium text-slate-700">{stepMeta.label}</span>
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
            Set up your profile
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            This information helps personalize your experience. You can generate a plan later from the dashboard.
          </p>
        </div>

        <div className="flex flex-col gap-5">{renderStep(stepMeta.key, showCurrentStepErrors)}</div>

        {submitError && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {submitError}
          </p>
        )}

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={goBack}
            disabled={currentStep === 0}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Back
          </button>

          {!isLastStep ? (
            <button
              type="button"
              onClick={goNext}
              disabled={!isCurrentStepValid}
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={finish}
              disabled={!isCurrentStepValid}
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save &amp; Continue
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
