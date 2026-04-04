import type { FocusEvent } from "react";
import { useMemo, useState } from "react";
import { useUserContextStore } from "@/store/userContext.store";
import type { UserContext } from "@/store/userContext.store";

type SymptomsStepProps = {
  showErrors?: boolean;
};

export function validateSymptomsStep(context: UserContext): boolean {
  return context.symptoms.text.trim().length > 0;
}

function extractTags(text: string): string[] {
  return text
    .split(/[^a-zA-Z0-9_]+/)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0);
}

export function SymptomsStep({ showErrors = false }: SymptomsStepProps) {
  const symptoms = useUserContextStore((s) => s.userContext.symptoms);
  const setSymptoms = useUserContextStore((s) => s.setSymptoms);

  const [touched, setTouched] = useState(false);
  const markTouched = (_event: FocusEvent<HTMLTextAreaElement>) => {
    setTouched(true);
  };

  const errors = useMemo(() => {
    const messages: string[] = [];
    if ((showErrors || touched) && symptoms.text.trim() === "") {
      messages.push("Please enter symptoms");
    }
    return messages;
  }, [showErrors, touched, symptoms.text]);

  return (
    <section>
      <label>
        Symptoms
        <textarea
          value={symptoms.text}
          onBlur={markTouched}
          onChange={(event) => {
            const text = event.target.value;
            setSymptoms({
              text,
              extracted_tags: extractTags(text),
            });
          }}
        />
      </label>

      <p>Extracted tags:</p>
      <p>{symptoms.extracted_tags.join(", ") || "No tags yet"}</p>

      {errors.length > 0 && <p>{errors.join(" | ")}</p>}
    </section>
  );
}
