const ML_PARSE_URL = "http://localhost:8000/parse";
const ML_TIMEOUT_MS = 2000;

async function parseSymptoms(text) {
  const safeText = typeof text === "string" ? text.trim() : "";

  if (!safeText) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, ML_TIMEOUT_MS);

  try {
    const response = await fetch(ML_PARSE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: safeText }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const symptomTags = data && Array.isArray(data.symptom_tags)
      ? data.symptom_tags.filter((tag) => typeof tag === "string" && tag.trim().length > 0)
      : null;

    if (!symptomTags) {
      return null;
    }

    return {
      symptom_tags: symptomTags,
    };
  } catch (error) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  parseSymptoms,
};
