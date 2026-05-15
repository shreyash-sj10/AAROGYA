import { useMemo, useState } from "react";
import { estimatePrakriti, type PrakritiEstimateRequest } from "@/services/api/prakriti.api";
import { ContractValidationError } from "@/services/api/apiClient";
import { useUserContextStore } from "@/store/userContext.store";

type AnswerKey = keyof PrakritiEstimateRequest["answers"];

function trimNonEmptyStrings(items: string[]): string[] {
  return items.map((item) => item.trim()).filter((item) => item.length > 0);
}

export function usePrakritiFlowHandler() {
  const symptoms = useUserContextStore((s) => s.userContext.symptoms);
  const prakriti = useUserContextStore((s) => s.userContext.prakriti);
  const setPrakriti = useUserContextStore((s) => s.setPrakriti);

  const [answers, setAnswers] = useState<Partial<PrakritiEstimateRequest["answers"]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canProceed = useMemo(() => Boolean(prakriti), [prakriti]);

  const setAnswer = (key: AnswerKey, value: PrakritiEstimateRequest["answers"][AnswerKey]) => {
    setError(null);
    setAnswers((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const estimateAndStore = async () => {
    setError(null);
    setLoading(true);

    try {
      const response = await estimatePrakriti({
        answers: answers as PrakritiEstimateRequest["answers"],
        symptoms: trimNonEmptyStrings(symptoms.extracted_tags),
      });

      if (response.error || !response.data) {
        const message = "Unable to process request. Please try a more specific question.";
        setError(message);
        return { ok: false as const, error: message };
      }

      setPrakriti({
        vata: response.data.vata,
        pitta: response.data.pitta,
        kapha: response.data.kapha,
        confidence: response.data.confidence,
      });

      return { ok: true as const, data: response.data };
    } catch (err) {
      const message = err instanceof ContractValidationError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Prakriti estimation failed.";
      setError(message);
      return { ok: false as const, error: message };
    } finally {
      setLoading(false);
    }
  };

  return {
    answers,
    setAnswer,
    estimateAndStore,
    loading,
    error,
    canProceed,
  };
}

