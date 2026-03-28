export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    return res.status(200).json({
      success: true,
      url,
      score: 78,
      issues: [
        "Missing meta description",
        "No clear CTA above the fold",
        "Heading structure could be improved"
      ],
      feedback: [
        "Add a strong main button in the hero section.",
        "Write a better meta description for search results.",
        "Use more H2 sections to improve readability."
      ]
    });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
}
