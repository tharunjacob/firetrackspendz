# TrackSpendZ — Reddit launch posts

Attach `trackspendz_demo.gif` as the image/media on every post. Lead with **r/vibecoding today**, then space the rest out (see cadence note at the bottom).

A note that applies everywhere: lead with the build/story or the free value, **not** the price. Don't claim "no signup" without the "to start" qualifier — CSV/Excel are signup-free, PDFs need an account. Put the link in the **first comment**, not the title, in any sub that's strict about self-promo.

---

## 1. r/vibecoding — POST TODAY (your lead)

This sub rewards the build story and honesty about how much was AI-assisted. Be a builder, not a marketer.

**Title (pick one):**
- I vibecoded a personal finance app that turns a bank statement into a full dashboard — drop a CSV, no signup
- Spent a few months vibecoding my own money tracker because I didn't want to hand my bank login to Mint-style apps

**Body:**
> I kept bouncing off budgeting apps for two reasons: they want a bank login, and they want a signup before you can even see if it's useful. So I built the opposite.
>
> TrackSpendZ lets you drop a CSV or Excel statement straight into the dashboard — no account, no bank connection — and it auto-categorizes everything (150+ built-in merchant rules, plus it learns from your edits) and gives you spending breakdowns, monthly trends, net worth, budgets, a FIRE calculator and a Spotify-Wrapped-style year review.
>
> Stack: React + TypeScript + Vite + Tailwind, Supabase for auth/DB, Gemini for the fuzzy stuff (file column mapping, the advisor chat). Anonymous uploads stay in your browser; nothing hits a server until you choose to sign up.
>
> Gif of the flow attached. It's live and the core is free. Would love feedback — especially on the upload/categorization step, since that's where most finance apps lose people.

**First comment:** `Link if anyone wants to throw a statement at it: https://trackspendz.com — genuinely curious what breaks.`

---

## 2. r/SideProject

Friendly to launches. Story + screenshot/gif works well.

**Title:** Drop a bank statement, get a full finance dashboard in ~10 seconds — no signup to start

**Body:**
> Built this over the last few months. You upload a CSV/Excel statement and it auto-categorizes transactions and builds 15 views — spending, trends, net worth, budgets, FIRE planner, year-in-review. No account needed to try it; anonymous data stays in your browser.
>
> Free for the core stuff. Gif attached. Happy to answer anything about the build or the categorization engine — open to feedback on what's confusing.

**First comment:** link to trackspendz.com

---

## 3. r/webdev (Showoff Saturday) or r/reactjs

Technical audience — talk shop, not features.

**Title:** Showoff Saturday: a finance dashboard that parses bank statements client-side (React + Vite + Supabase)

**Body:**
> A personal-finance app where the whole upload-and-analyze flow runs without an account — CSV/Excel parsed in-browser, transactions auto-categorized with a 150+ rule engine that also learns from user edits, then rendered into ~15 dashboard views with Recharts.
>
> React 18 + TS + Vite + Tailwind, Supabase for auth/RLS, Gemini behind an edge-function proxy so the key never ships to the client. Anonymous transactions live in memory/localStorage and only promote to cloud on signup.
>
> Gif of the flow attached. Happy to go into the parsing/categorization or the anonymous→cloud promotion if anyone's interested.

**First comment:** link

---

## 4. r/personalfinanceindia

Your primary market (₹ pricing). Keep it useful and humble; this sub tolerates "I built a free tool" better than the US finance subs, but still put the link in a comment.

**Title:** Made a free tool that turns your bank/card statement into a spending + net worth dashboard (no bank login)

**Body:**
> Got tired of manually tagging UPI/card spends in spreadsheets, so I built something that takes a CSV/Excel statement export and auto-categorizes it — then shows where the money's going, monthly trends, savings rate, net worth and a FIRE number.
>
> No bank account linking and no signup needed to try it — you just upload the statement file and it stays in your browser. Free for the core; there's a paid tier but you don't need it to get the analysis.
>
> Sharing because the no-bank-login part seems to matter to people here. Feedback welcome, especially on Indian bank statement formats — tell me if yours doesn't parse cleanly and I'll fix it.

**First comment:** link + "drop me the bank name if a format breaks."

---

## 5. r/financialindependence / r/Fire — APPROACH WITH CARE

These subs are strict on self-promotion and may remove standalone launch posts. Two safer plays:
- Post in their **weekly/daily threads** ("what tools do you use") rather than a top-level post.
- Or lead hard with the FIRE calculator as the free value, link only in a comment, and read the sub rules first.

**If a top-level post is allowed — Title:** Built a free FIRE calculator + net worth tracker that works off your actual statements (no signup to start)

**Body:**
> Most FIRE calculators make you type in numbers you have to guess at. This one pulls from your real statements — upload a CSV, it categorizes spend and savings rate, then runs the FIRE number with scenarios and a Monte Carlo simulation. Net worth tracking too.
>
> Free to use the calculator, no account needed to start. Not trying to spam — happy to remove if this isn't the place. Gif of the flow attached.

**First comment:** link

---

## 6. r/budget or r/ynab-adjacent budgeting subs

**Title:** Free budgeting dashboard that auto-categorizes from your statement instead of manual entry

**Body:**
> If manual transaction entry is what kills your budgeting habit — this auto-categorizes a CSV/Excel statement and gives you monthly category budgets with 80%/100% alerts, recurring-charge detection, and goals. No signup to try it.

**First comment:** link

(Check each sub's rules — some budgeting subs ban promo outright. r/ynab specifically is hostile to competitors; skip it or only mention in "alternatives" threads.)

---

## Reddit hygiene — don't get shadowbanned

- **Space them out.** One sub per day, not all six today. Blasting the same link across subs in an hour is the fastest way to get auto-filtered.
- **9:1 rule.** Reddit expects roughly 9 normal comments/posts for every 1 self-promo. If your account is brand new or all-promo, posts get auto-removed. Warm it up by commenting genuinely first.
- **Reply to every comment** in the first hour — engagement keeps the post alive and signals good faith.
- **Read each sub's rules + check if "Self-promo Saturday"-type threads exist.** Many finance subs only allow promo on specific days.
- **Don't reuse the identical body** across subs — Reddit's spam filter flags duplicate text. The variants above are already different; keep them that way.
- **Expect the big US finance subs (r/personalfinance, r/financialindependence) to be the hardest.** Your easy wins are r/vibecoding, r/SideProject, r/webdev, r/personalfinanceindia.
