module.exports = {

    provider: "edge",

    // NOTE (Japanese voice): "ja-JP-NanamiNeural" is Microsoft's standard,
    // long-established neural voice for this locale, in the same catalog/
    // naming scheme as the Tamil/English voices below. This environment has
    // no network access to Microsoft's live voice-list API to positively
    // confirm it at write time - verify with a live MsEdgeTTS.getVoices()
    // call (filter Locale === "ja-JP") in an environment with network
    // access before relying on it in production.
    voice: {

        tamil: "ta-IN-PallaviNeural",

        english: "en-US-AvaNeural",

        japanese: "ja-JP-NanamiNeural"

    },

    rate: "+0%",

    pitch: "+0Hz",

    volume: "+0%"

};
