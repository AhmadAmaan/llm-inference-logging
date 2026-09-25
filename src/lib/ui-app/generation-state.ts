type GenerationEntry = {
  controller: AbortController;
  assistantMessageId: string;
};

const globalState = globalThis as typeof globalThis & {
  __llmInferenceGenerationMap?: Map<string, GenerationEntry>;
};

const generationMap =
  globalState.__llmInferenceGenerationMap ?? new Map<string, GenerationEntry>();

if (!globalState.__llmInferenceGenerationMap) {
  globalState.__llmInferenceGenerationMap = generationMap;
}

export function registerGeneration(
  conversationId: string,
  assistantMessageId: string,
  controller: AbortController,
) {
  generationMap.set(conversationId, {
    controller,
    assistantMessageId,
  });
}

export function cancelGeneration(conversationId: string) {
  const generation = generationMap.get(conversationId);
  if (!generation) {
    return null;
  }

  generation.controller.abort();
  return generation.assistantMessageId;
}

export function clearGeneration(conversationId: string) {
  generationMap.delete(conversationId);
}

export function getGeneration(conversationId: string) {
  return generationMap.get(conversationId) ?? null;
}
