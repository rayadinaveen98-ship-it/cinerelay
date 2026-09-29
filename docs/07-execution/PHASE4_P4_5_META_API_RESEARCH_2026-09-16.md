# P4.5 Meta Instagram API Research Checkpoint

Date: 2026-09-16

## Official-source findings

Meta's current official Instagram API workspace confirms that Instagram API with Facebook Login supports Instagram Professional accounts (Business and Creator), requires a Facebook Page linked to a Professional Instagram account, and can retrieve basic metadata and metrics about other Instagram Business and Creator accounts.

The same official material states that consumer/personal Instagram accounts are not accessible through this API configuration.

Meta's token setup examples retrieve managed Pages plus their linked `instagram_business_account` ID, then use a Page access token for Graph API calls. Official examples expose the Graph API version through an `api_version` variable instead of treating one API version as permanent.

## CineRelay implementation consequence

P4.5 therefore uses:

- Facebook Login / Page-linked Instagram Professional credentials;
- Business Discovery for curated external Professional accounts;
- `graph.facebook.com`;
- server-configured Graph API version;
- server-only access token and managed IG user ID;
- no consumer-account completeness claim;
- no browser-session scraping or private/mobile API dependency.

## Production gate

The engineering implementation can be built and hosted before credentials exist, but no scheduler cron or production-verification claim is allowed until a real Meta authorization, managed Professional IG account, official target account baseline, genuine post-baseline media item, and duplicate-free repeat have been proven.
