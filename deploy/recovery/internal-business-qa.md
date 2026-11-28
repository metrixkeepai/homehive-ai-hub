# Production Business browser acceptance

Reserve matrixkeep-qa+business@matrixkeep.com for the release team. Use a dedicated workspace named MatrixKeep Internal QA. The account must have no customer workspace memberships or customer records. Store its sign-in password only as CAPTURE_QA_INTERNAL_BUSINESS_PASSWORD in the protected production environment. The runner never falls back to customer Business credentials.

For future full runs, provision this account through normal Business onboarding and assign an existing eligible Business tier through the internal voucher process. Verify that the grant is active, includes the features under test, has no Stripe subscription or checkout, and has at least ten account-wide captures available for an eight-mode run (two each for English and Malayalam). Use synthetic documents and the approved private human fixture. Renew the internal grant through its normal lifecycle. Exercise Free-plan restrictions separately.

A QA ENVIRONMENT result marks incomplete coverage. The raw job remains unsuccessful and its report is retained. An owner may accept a specific release separately with a dated record matching its run, serving SHA and tested flows.
