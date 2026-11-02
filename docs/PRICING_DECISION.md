# Launch pricing decision — November 1, 2026

The owner delegated choosing price/limits for attractiveness, scalability and profitability. Adopt Free (10 successful invoice scans/month) and Pro ($19.99/month, 150 successful invoice scans and 25 AI recipe draft attempts/month). Paid features remain included. Manual edits do not spend AI attempts. Keep the Apple product a draft until phone/StoreKit and accuracy tests pass.

This replaces the earlier provisional $24.99 / 500-scan / 50-recipe proposal. The lower entry price targets a small restaurant; 150 invoices is roughly five per day. This is a product positioning assumption, not measured customer demand. Do not promise profit or savings.

## Cost sensitivity

The current extraction model is Sonnet 5, listed at $2 per million input tokens and $10 per million output tokens in [Anthropic's model documentation](https://platform.claude.com/docs/en/models/sonnet-5/overview), checked November 1. Per-request base model cost is input_tokens*0.000002 + output_tokens*0.000010. Duplicate-header prechecks, retries and infrastructure add cost.

Illustrative assumptions, not observed averages:

- A 5,000-input / 1,500-output scan costs $0.025; 150 such successful scans cost $3.75.
- A heavy 15,000-input / 4,096-output scan costs about $0.071; 150 cost about $10.64.
- Recipe output is capped at 2,048 tokens; 25 drafts at 5,000 input / 2,048 output would cost about $0.76.

Apple's [standard subscription proceeds](https://developer.apple.com/app-store/subscriptions/) are 70% initially and 85% after one paid year; enrolled Small Business Program members receive 85%, before applicable taxes. At $19.99 that is approximately $13.99 or $16.99 before taxes and other costs. Enrollment is not confirmed. Actual agreements, taxes, refunds, RevenueCat fees, hosting, storage, support and acquisition costs reduce the remainder.

Monthly invoice attempt budgets include failed attempts: successful-scan cap plus the greater of 10 or 20% of the cap (Free 20, Pro 180). Existing hourly/daily request limits remain. Recipe limits count attempts, including failed ones. These bounds control repeated-failure exposure; an abuse spike across many accounts can still cost money. Monitor service spend and use the AI_PROCESSING_ENABLED kill switch if needed.

## Required validation

Measure token usage, latency, failed/duplicate attempt rates and operator corrections on at least 20 representative approved invoices (including long and multi-page examples). The single fictional fixture proves functionality only. Confirm margin after actual Apple proceeds and recurring service bills. Revisit the price/limit before public launch if heavy-use economics or customer demand differ from these assumptions. No annual plan or unlimited scanning is offered.
