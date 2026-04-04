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
  { key: "profile", label: "Profile Information", validate: validateProfileStep },
  { key: "health", label: "Health Information", validate: validateHealthStep },
  { key: "symptoms", label: "Symptoms", validate: validateSymptomsStep },
  { key: "goals", label: "Goals", validate: validateGoalsStep },
  { key: "constraints", label: "Dietary Constraints", validate: validateConstraintsStep },
] as const;

type StepKey = typeof STEP_CONFIG[number]["key"];

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

  return (
    <main style={{ maxWidth: 680, margin: "32px auto", padding: "0 16px" }}>
      <h2>Onboarding</h2>
      <p>{`Step ${currentStep + 1} of ${totalSteps} - ${stepMeta.label}`}</p>

      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        {renderStep(stepMeta.key, showCurrentStepErrors)}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button
          type="button"
          onClick={() => {
            setSubmitError(null);
            setCurrentStep((prev) => Math.max(0, prev - 1));
          }}
          disabled={currentStep === 0}
        >
          Back
        </button>

        {!isLastStep && (
          <button
            type="button"
            onClick={() => {
              setSubmitError(null);

              if (!isCurrentStepValid) {
                setShowErrorsByStep((prev) => ({ ...prev, [currentStep]: true }));
                return;
              }

              setShowErrorsByStep((prev) => ({ ...prev, [currentStep]: false }));
              setCurrentStep((prev) => Math.min(totalSteps - 1, prev + 1));
            }}
            disabled={!isCurrentStepValid}
          >
            Next
          </button>
        )}

        {isLastStep && (
          <button
            type="button"
            onClick={() => {
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
                setSubmitError("Please complete all required onboarding fields");
                return;
              }

              setUserContext(context);
              navigate("/app/dashboard");
            }}
            disabled={!isCurrentStepValid}
          >
            Save & Continue
          </button>
        )}
      </div>

      {submitError && <p>{submitError}</p>}
    </main>
  );
}
