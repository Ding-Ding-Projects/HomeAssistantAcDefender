namespace HomeAssistantAcDefender.Services;

/// <summary>
/// 口語廣東話 — app chrome: navigation, page titles, master switch, common buttons and labels.
/// Keys are the EXACT English source strings. Colloquial written Cantonese (唔/嘅/喺),
/// Traditional script; technical terms (AC, Home Assistant, setpoint numbers) stay as-is.
/// </summary>
public static class YueCommon
{
    public static void AddTo(Dictionary<string, string> map)
    {
        // ── Nav rail stations ──
        map["COMMAND"] = "指揮部";
        map["DEFENSE"] = "防衛";
        map["COMFORT"] = "舒適";
        map["ENERGY"] = "能源";
        map["LOGS"] = "紀錄";
        map["CONTROLS"] = "操控";
        map["ORDERS"] = "指令";
        map["GUIDE"] = "手冊";
        map["STATIONS"] = "崗位";
        map["OPEN TABS"] = "開啟分頁";
        map["Open pages"] = "開啟頁面";
        map["CHANGELOG"] = "版本紀錄";

        // ── Browser-style tab discovery ──
        map["Tab search and bulk close"] = "分頁搜尋同批量關閉";
        map["open tabs"] = "個開啟分頁";
        map["Search visible tab labels only. Plain text is the default; each field has its own full regex builder."] = "只搜尋分頁顯示名稱。預設係純文字；每個欄位都有自己完整正則建構器。";
        map["Current tab strip search"] = "目前分頁列搜尋";
        map["Search this strip…"] = "搜尋呢條分頁列…";
        map["Current strip matches"] = "目前分頁列結果";
        map["Tab group search"] = "分頁群組搜尋";
        map["Group scope"] = "群組範圍";
        map["All groups"] = "全部群組";
        map["Search tabs in this group…"] = "搜尋呢個群組嘅分頁…";
        map["Tab group matches"] = "分頁群組結果";
        map["Tab group names search"] = "分頁群組名稱搜尋";
        map["Search group names…"] = "搜尋群組名稱…";
        map["Tab group name matches"] = "分頁群組名稱結果";
        map["Master tab search"] = "總分頁搜尋";
        map["Search every open tab…"] = "搜尋所有開啟分頁…";
        map["Master tab matches"] = "總分頁結果";
        map["matches"] = "個結果";
        map["groups"] = "個群組";
        map["matches across all open tabs"] = "個結果（所有開啟分頁）";
        map["Close tabs containing text"] = "關閉包含文字嘅分頁";
        map["Close tabs not containing text"] = "關閉唔包含文字嘅分頁";
        map["Text or pattern…"] = "文字或模式…";
        map["Include pinned"] = "包括釘選分頁";
        map["Preview close"] = "預覽關閉";
        map["Review tabs containing text"] = "檢查包含文字嘅分頁";
        map["Review tabs not containing text"] = "檢查唔包含文字嘅分頁";
        map["Enter a non-empty query before previewing a close."] = "預覽關閉之前，要先輸入唔可以留空嘅搜尋。";
        map["tabs will close"] = "個分頁會關閉";
        map["protected or excluded"] = "個受保護或排除";
        map["Emergency exit"] = "緊急退出";
        map["Confirm close"] = "確認關閉";
        map["pinned"] = "已釘選";

        // ── Right-click / keyboard / long-press context menus ──
        map["AC Defender application shell"] = "AC Defender 應用程式介面";
        map["Right-click, press Shift+F10, or press and hold to edit this tab."] = "右擊、撳 Shift+F10，或者長按去編輯呢個分頁。";
        map["Tab context menu"] = "分頁快捷選單";
        map["Tab group context menu"] = "分頁群組快捷選單";
        map["Control context menu"] = "控制項快捷選單";
        map["Surface context menu"] = "介面快捷選單";
        map["Close context menu"] = "關閉快捷選單";
        map["Search this menu"] = "搜尋呢個快捷選單";
        map["Filter visible actions…"] = "篩選顯示中嘅操作…";
        map["Context actions"] = "快捷操作";
        map["No menu actions match this search."] = "冇快捷操作符合呢次搜尋。";
        map["Activate tab"] = "開啟分頁";
        map["Pin tab"] = "釘選分頁";
        map["Unpin tab"] = "取消釘選分頁";
        map["Edit tab appearance…"] = "編輯分頁外觀…";
        map["Close tab"] = "關閉分頁";
        map["Search tabs in this group"] = "搜尋呢個群組嘅分頁";
        map["Edit group appearance…"] = "編輯群組外觀…";
        map["Remove group assignment"] = "移除群組指派";
        map["Edit appearance…"] = "編輯外觀…";
        map["Copy accessible label"] = "複製無障礙標籤";
        map["Open link in new browser tab"] = "喺新瀏覽器分頁開啟連結";
        map["Pinned tabs are protected. Unpin this tab before closing it."] = "釘選分頁受保護；要先取消釘選先可以關閉。";
        map["The active tab stays open so the current page and unsaved work remain protected."] = "使用中嘅分頁會保持開啟，保護目前頁面同未儲存工作。";
        map["The command tab stays available as the navigation fallback."] = "指揮分頁會保留，做導覽後備出口。";
        map["Rename tab group"] = "重新命名分頁群組";
        map["Tab group"] = "分頁群組";
        map["Optional group name"] = "可選群組名稱";
        map["Apply group"] = "套用群組";
        map["Keyboard: Shift+F10 opens this menu. Shift+Alt+A opens appearance editing. On touch, press and hold a tab."] = "鍵盤：Shift+F10 開呢個選單；Shift+Alt+A 開外觀編輯。觸控就長按分頁。";

        // ── Page titles ──
        map["Command Center"] = "指揮中心";
        map["Defense Roster"] = "防衛名冊";
        map["Comfort Watch"] = "舒適哨崗";
        map["Energy Intel"] = "能源情報";
        map["Field Reports"] = "戰地報告";
        map["Direct Controls"] = "直接操控";
        map["Standing Orders"] = "長期指令";
        map["Field Manual"] = "野戰手冊";

        // ── Master switch ──
        map["MASTER SWITCH"] = "總開關";
        map["⛨ STAND DOWN"] = "⛨ 收隊";
        map["⏻ ACTIVATE"] = "⏻ 開工";
        map["The guard post is awake and caffeinated."] = "哨崗醒晒神，咖啡都飲埋。";
        map["Paused. Tap to wake the tiny guard shift."] = "暫停咗。撳一下叫班小衛兵返工。";

        // ── Mood labels ──
        map["STANDING DOWN"] = "收隊休息";
        map["GUARDS ENGAGED"] = "衛兵出動";
        map["ON WATCH"] = "當值中";
        map["HA OFFLINE"] = "HA 離線";

        // ── Common buttons / labels ──
        map["Refresh"] = "刷新";
        map["Force target"] = "強制目標";
        map["Force cooling"] = "強制降溫";
        map["Emergency"] = "緊急";
        map["Learning"] = "學習";
        map["1 hour"] = "1 個鐘";
        map["2 hours"] = "2 個鐘";
        map["4 hours"] = "4 個鐘";
        map["Wake the guards now"] = "即刻叫醒衛兵";
        map["Mess hall (siesta)"] = "飯堂（午睡）";
        map["Guards asleep"] = "衛兵瞓緊";
        map["Guards on duty"] = "衛兵當值";
        map["Off"] = "閂咗";
        map["Monthly budget"] = "每月預算";
        map["Field kitchen — rations"] = "野戰廚房 — 口糧";
        map["Energy overview"] = "能源總覽";
        map["Real thermostat actions"] = "真溫控器操作";
        map["SUMMON AI REACTOR OPERATOR — 1 ration / hour"] = "召喚 AI 反應堆操作員 — 每個鐘 1 份口糧";

        // ── Presentation preferences ──
        map["Language & tone"] = "語言同語氣";
        map["Choose how this website speaks"] = "揀呢個網站點樣講嘢";
        map["Language mode"] = "語言模式";
        map["English"] = "英文";
        map["Playful Hong Kong Cantonese · 口語廣東話"] = "玩味香港廣東話 · 口語廣東話";
        map["Bilingual · English + 粵"] = "雙語 · English + 粵";
        map["English funny level"] = "英文玩味程度";
        map["Cantonese funny level"] = "廣東話玩味程度";
        map["Preview · 預覽"] = "預覽 · Preview";

        // ── Field kitchen metrics ──
        map["Pantry balance"] = "口糧倉結餘";
        map["Earned today"] = "今日賺到";
        map["Released this month"] = "今個月放出";
        map["Hot window"] = "熱窗口";
        map["Duty cycle"] = "開機比例";
        map["Rations"] = "口糧";

        // ── Cool-outdoor card metrics ──
        map["Outdoor now"] = "而家出面";
        map["Shutdown below"] = "低過就熄";
        map["Restores at"] = "回復溫度";
        map["Forecast peak"] = "預報最高";
        map["Forecast gate"] = "預報閘";
        map["Off dwell"] = "熄機最短時間";

        // ── Siesta card metrics ──
        map["Nap ends"] = "瞓到幾點";
        map["Reason"] = "原因";
        map["Rations this nap"] = "今次瞓覺賺到";
        map["Start action"] = "開始動作";
        map["Watching"] = "睇緊";
        map["Sleeping"] = "瞓緊";
        map["On duty"] = "當值";
        map["Human override"] = "有人手動改咗";
        map["AC OFF"] = "AC 熄咗";
        map["Pass"] = "通過";
        map["Blocking"] = "攔住";
        map["Stocked"] = "有貨";
        map["Empty"] = "空嘅";
        map["Paying the bill"] = "幫緊 AC 埋單";
        map["Reactor"] = "反應堆";
        map["Powered until"] = "有電到";
        map["Unpowered"] = "冇電";
    }
}
