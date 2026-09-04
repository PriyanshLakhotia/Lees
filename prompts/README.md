# Additive prompt modules

Story requests are composed at runtime in this order:

1. `story/base.md` — universal writing and output rules
2. `story/types/<type>.md` — news, explainer, history/culture, fiction, or grammar lesson rules
3. `story/levels/<level>.md` — A0 through C1 language constraints
4. `story/lengths/<length>.md` — short, medium, or long target
5. A generated request block — the selected topic, genre, idea, date, level, and length

Word annotation, sentence translation, and chat have independent additive base prompts. Keeping the modules separate makes level calibration and content behaviour editable without changing application code.
