# Recogniser model

`zipformer_p_arabic_v3.1.int8.onnx`, `tokens.txt` and `LICENSE` are unchanged files of
[Quran-Lab/zipformer_p-arabic-v3](https://huggingface.co/Quran-Lab/zipformer_p-arabic-v3) (Quran Lab, Muno459):
a streaming phoneme recogniser for Quran recitation (Hafs), v3.1. `model.json` (what the browser needs to run it) and
`words.json` (the units of every word of MyHifz, taken from the model's `ordered_quran_phonemes.json`) are made from
them by `dev/tools/asr_model.py` and `dev/tools/asr_words.py`; as derivatives they are under the same license.

All of it is under the **Quran-Lab No-Profit License 1.2** (see `LICENSE`): free to use, study, adapt and pass on,
never for payment, behind a paywall or with advertising.

When access was granted, MyHifz agreed (1) never to charge for the model, for access to it, or for any feature it
powers, (2) not to present its output as an authoritative religious ruling on anyone's recitation, and (3) to state
clearly that automatic tajweed feedback can be wrong and does not replace a qualified teacher. MyHifz is free, has no
advertising, and says so in its settings.
