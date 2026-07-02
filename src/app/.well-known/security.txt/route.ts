export function GET() {
  return new Response(
    [
      "Contact: mailto:security@cleancurbco.com",
      "Policy: https://cleancurbco.com/vulnerability-disclosure",
      "Preferred-Languages: en",
      "Canonical: https://cleancurbco.com/.well-known/security.txt",
      "Expires: 2027-07-02T00:00:00.000Z",
      "",
    ].join("\n"),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
