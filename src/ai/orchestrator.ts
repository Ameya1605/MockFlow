export async function generateMockResponse(prompt: string, apiKey: string): Promise<any> {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`Gemini API request failed with status ${response.status}: ${responseText}`);
    }

    const data = JSON.parse(responseText) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    const cleanedText = rawText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    return JSON.parse(cleanedText);
  } catch (error) {
    throw new Error(`Failed to generate mock response: ${error instanceof Error ? error.message : String(error)}`);
  }
}
