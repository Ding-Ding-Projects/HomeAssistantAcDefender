namespace HomeAssistantAcDefender.Services;

/// <summary>Presentation-only voice styling. It never changes the facts in a message.</summary>
public static class FunnyTone
{
    public static string English(string text, int level) => Math.Clamp(level, 1, 5) switch
    {
        2 => $"{text} — keeping the paperwork tidy.",
        3 => $"{text} — the tiny containment crew is on it.",
        4 => $"{text} — the thermostat has entered its paperwork era.",
        5 => $"{text} — the AC goblin is on patrol, clipboard and all.",
        _ => text
    };

    public static string Cantonese(string text, int level) => Math.Clamp(level, 1, 5) switch
    {
        2 => $"{text}，做得幾順喎。",
        3 => $"{text}，班小衛兵又返工喇。",
        4 => $"{text}，個溫控器而家忙住做文書。",
        5 => $"{text}，冷氣小妖揸住文件夾巡場喇！",
        _ => text
    };
}
