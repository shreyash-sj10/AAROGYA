import { useCallback, useState } from "react";

export function useRunPrakritiAssessment() {
  const [isPrakritiAssessmentOpen, setIsPrakritiAssessmentOpen] = useState(false);

  const runPrakritiAssessment = useCallback(() => {
    setIsPrakritiAssessmentOpen(true);
  }, []);

  const closePrakritiAssessment = useCallback(() => {
    setIsPrakritiAssessmentOpen(false);
  }, []);

  return {
    isPrakritiAssessmentOpen,
    runPrakritiAssessment,
    closePrakritiAssessment,
  };
}
