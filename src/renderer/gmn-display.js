(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  root.gmnDisplay = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function round(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  function formatUsd(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return '-';
    }

    return `$${value.toFixed(2)}`;
  }

  function formatCount(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return '-';
    }

    return numericValue.toLocaleString('en-US', {
      maximumFractionDigits: Number.isInteger(numericValue) ? 0 : 2
    });
  }

  function buildProgressGradient(progressPercent) {
    const percent = clamp(Number(progressPercent) || 0, 0, 100);
    const baseHue = Math.round((percent / 100) * 120);
    const startHue = clamp(baseHue - 18, 0, 120);
    const endHue = clamp(baseHue + 10, 12, 132);

    return `linear-gradient(90deg, hsl(${startHue} 84% 56%) 0%, hsl(${endHue} 80% 64%) 100%)`;
  }

  function formatDuration(seconds) {
    const totalSeconds = Math.max(0, Math.round(Number(seconds) || 0));

    if (totalSeconds <= 0) {
      return 'now';
    }

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (days > 0) {
      return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    }

    if (hours > 0) {
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }

    if (minutes > 0) {
      return `${minutes}m`;
    }

    return `${totalSeconds}s`;
  }

  function formatUsageWindow(limitWindowSeconds) {
    const seconds = Math.max(0, Number(limitWindowSeconds) || 0);

    if (!seconds) {
      return 'Usage';
    }

    const days = seconds / 86400;
    if (Number.isInteger(days) && days > 0) {
      return `${days}d`;
    }

    const hours = seconds / 3600;

    if (Number.isInteger(hours)) {
      return `${hours}h`;
    }

    if (seconds % 60 === 0) {
      return `${Math.round(seconds / 60)}m`;
    }

    return `${seconds}s`;
  }

  function formatPlanLabel(planType) {
    const normalized = String(planType || '').trim().toLowerCase();

    if (normalized === 'plus') {
      return 'ChatGPT Plus';
    }

    if (normalized === 'pro') {
      return 'ChatGPT Pro';
    }

    if (normalized === 'team') {
      return 'ChatGPT Team';
    }

    if (normalized === 'enterprise') {
      return 'ChatGPT Enterprise';
    }

    if (normalized) {
      return `ChatGPT ${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
    }

    return 'ChatGPT';
  }

  function buildGmnQuotaCardModel(keyOverview) {
    return buildUsageQuotaCardModel(keyOverview);
  }

  function buildUsageQuotaCardModel(keyOverview) {
    if (!keyOverview) {
      return {
        titleText: 'Current Key',
        subtitleText: 'Unavailable',
        remainingText: '-',
        totalText: '-',
        progressPercent: 0,
        progressText: '-',
        progressDetailText: '-',
        progressGradient: buildProgressGradient(0)
      };
    }

    const progressPercent = round(keyOverview.progressPercent);
    const remainingText = formatUsd(round(keyOverview.remainingQuota));
    const totalText = formatUsd(round(keyOverview.totalQuota));

    return {
      titleText: keyOverview.name || 'Current Key',
      subtitleText: keyOverview.maskedKey || 'Unavailable',
      remainingText,
      totalText,
      progressPercent,
      progressText: `${progressPercent.toFixed(2)}% left`,
      progressDetailText: `${remainingText} / ${totalText}`,
      progressGradient: buildProgressGradient(progressPercent)
    };
  }

  function buildPresetProgressItem({
    labelText,
    progressPercent,
    progressText,
    progressDetailText,
    progressGradient
  }) {
    return {
      labelText,
      percent: clamp(progressPercent, 0, 100),
      text: progressText,
      detailText: progressDetailText,
      gradient: progressGradient
    };
  }

  function buildRateLimitProgressItem(windowOverview, labelText) {
    const remainingPercent = round(windowOverview?.remainingPercent);
    const usedPercent = round(windowOverview?.usedPercent);
    const progressPercent = clamp(windowOverview?.remainingPercent, 0, 100);
    const resetText =
      Number(windowOverview?.resetAfterSeconds) > 0
        ? `resets in ${formatDuration(windowOverview.resetAfterSeconds)}`
        : 'reset pending';

    return buildPresetProgressItem({
      labelText,
      progressPercent,
      progressText: `${remainingPercent.toFixed(2)}% left`,
      progressDetailText: `${usedPercent.toFixed(2)}% used · ${resetText}`,
      progressGradient: buildProgressGradient(progressPercent)
    });
  }

  function buildDailyUsagePresetCardModel(keyOverview, fallbackMaskedKey = '') {
    const usedPercent = round(keyOverview?.usedPercent);
    const usedText = formatUsd(round(keyOverview?.usedQuota));
    const totalText = formatUsd(round(keyOverview?.totalQuota));
    const detailParts = [`${usedPercent.toFixed(2)}% used`];
    const dayScoreDate = String(keyOverview?.dayScoreDate || '').trim();

    if (dayScoreDate) {
      detailParts.push(dayScoreDate);
    }

    const progressItem = buildPresetProgressItem({
      labelText: 'Today Used',
      progressPercent: usedPercent,
      progressText: `${usedText} / ${totalText}`,
      progressDetailText: detailParts.join(' · '),
      progressGradient: buildProgressGradient(100 - usedPercent)
    });
    const rawStatus = typeof keyOverview?.status === 'string' ? keyOverview.status.trim() : '';

    return {
      keyText: keyOverview?.maskedKey || fallbackMaskedKey || 'Unavailable',
      remainingText: usedText,
      totalText,
      progressLabelText: progressItem.labelText,
      progressPercent: progressItem.percent,
      progressText: progressItem.text,
      progressDetailText: progressItem.detailText,
      progressGradient: progressItem.gradient,
      progressItems: [progressItem],
      statusText: rawStatus ? rawStatus.toUpperCase() : 'ACTIVE'
    };
  }

  function buildOpenAiUsagePresetCardModel(keyOverview) {
    const primaryItem = buildRateLimitProgressItem(
      {
        remainingPercent: keyOverview?.remainingQuota,
        usedPercent: keyOverview?.usedQuota,
        resetAfterSeconds: keyOverview?.resetAfterSeconds
      },
      `${formatUsageWindow(keyOverview?.limitWindowSeconds)} Window Left`
    );
    const secondaryItem = keyOverview?.secondaryWindow
      ? buildRateLimitProgressItem(
          keyOverview.secondaryWindow,
          `${formatUsageWindow(keyOverview.secondaryWindow.limitWindowSeconds)} Window Left`
        )
      : null;
    const reviewPrimaryWindow = keyOverview?.codeReviewRateLimit?.primaryWindow;
    const reviewItem = reviewPrimaryWindow
      ? buildRateLimitProgressItem(
          reviewPrimaryWindow,
          `Review ${formatUsageWindow(reviewPrimaryWindow.limitWindowSeconds)} Left`
        )
      : null;
    const progressItems = [primaryItem, secondaryItem, reviewItem].filter(Boolean);
    const leadItem = progressItems[0] || buildPresetProgressItem({
      labelText: '5h Window Left',
      progressPercent: 0,
      progressText: '-',
      progressDetailText: '-',
      progressGradient: buildProgressGradient(0)
    });

    return {
      keyText: formatPlanLabel(keyOverview?.planType),
      remainingText: leadItem.text.replace(' left', ''),
      totalText: '100.00%',
      progressLabelText: leadItem.labelText,
      progressPercent: leadItem.percent,
      progressText: leadItem.text,
      progressDetailText: leadItem.detailText,
      progressGradient: leadItem.gradient,
      progressItems,
      statusText: String(keyOverview?.status || 'active')
        .trim()
        .toUpperCase()
    };
  }

  function buildOpenAiUnavailablePresetCardModel() {
    const progressItems = [
      buildPresetProgressItem({
        labelText: '5h Window Left',
        progressPercent: 0,
        progressText: '-',
        progressDetailText: 'Sign in with ChatGPT to read the live limit.',
        progressGradient: buildProgressGradient(0)
      }),
      buildPresetProgressItem({
        labelText: '7d Window Left',
        progressPercent: 0,
        progressText: '-',
        progressDetailText: 'Weekly limit appears after ChatGPT sign-in.',
        progressGradient: buildProgressGradient(0)
      }),
      buildPresetProgressItem({
        labelText: 'Review 7d Left',
        progressPercent: 0,
        progressText: '-',
        progressDetailText: 'Review limit appears after ChatGPT sign-in.',
        progressGradient: buildProgressGradient(0)
      })
    ];

    return {
      keyText: 'ChatGPT sign-in required',
      remainingText: '-',
      totalText: '-',
      progressLabelText: progressItems[0].labelText,
      progressPercent: progressItems[0].percent,
      progressText: progressItems[0].text,
      progressDetailText: progressItems[0].detailText,
      progressGradient: progressItems[0].gradient,
      progressItems,
      statusText: 'SIGN IN'
    };
  }

  function buildQuan2GoUnavailablePresetCardModel() {
    const progressItem = buildPresetProgressItem({
      labelText: 'Today Used',
      progressPercent: 0,
      progressText: '-',
      progressDetailText: 'Enter the activation code to read daily usage.',
      progressGradient: buildProgressGradient(0)
    });

    return {
      keyText: 'Activation code required',
      remainingText: '-',
      totalText: '-',
      progressLabelText: progressItem.labelText,
      progressPercent: progressItem.percent,
      progressText: progressItem.text,
      progressDetailText: progressItem.detailText,
      progressGradient: progressItem.gradient,
      progressItems: [progressItem],
      statusText: 'ENTER CODE'
    };
  }

  function buildOpenRouterFreeEstimatePresetCardModel(keyOverview, fallbackMaskedKey = '') {
    const dailyLimit = Math.max(0, Number(keyOverview?.dailyLimit) || 0);
    const estimatedUsedCount = Math.max(0, Number(keyOverview?.estimatedUsedCount) || 0);
    const estimatedRemainingCount = Math.max(0, Number(keyOverview?.estimatedRemainingCount) || 0);
    const progressPercent = clamp(Number(keyOverview?.progressPercent) || 0, 0, 100);
    const detailParts = [
      `本地今日 ${formatCount(estimatedUsedCount)} / ${formatCount(dailyLimit)} 次`
    ];

    if (typeof keyOverview?.totalCredits === 'number' && Number.isFinite(keyOverview.totalCredits)) {
      detailParts.push(`credits ${formatCount(keyOverview.totalCredits)}`);
    }

    if (typeof keyOverview?.totalUsage === 'number' && Number.isFinite(keyOverview.totalUsage)) {
      detailParts.push(`usage ${formatCount(keyOverview.totalUsage)}`);
    }

    if (typeof keyOverview?.todayModelTokens === 'number' && Number.isFinite(keyOverview.todayModelTokens) && keyOverview.todayModelTokens > 0) {
      detailParts.push(`tokens ${formatCount(keyOverview.todayModelTokens)}`);
    }

    const progressItem = buildPresetProgressItem({
      labelText: 'Daily Free Left',
      progressPercent,
      progressText: `${formatCount(estimatedRemainingCount)} 次剩余`,
      progressDetailText: detailParts.join(' · '),
      progressGradient: buildProgressGradient(progressPercent)
    });

    return {
      keyText: keyOverview?.maskedKey || fallbackMaskedKey || 'OpenRouter',
      remainingText: formatCount(estimatedRemainingCount),
      totalText: formatCount(dailyLimit),
      progressLabelText: progressItem.labelText,
      progressPercent: progressItem.percent,
      progressText: progressItem.text,
      progressDetailText: progressItem.detailText,
      progressGradient: progressItem.gradient,
      progressItems: [progressItem],
      statusText: 'ESTIMATE'
    };
  }

  function buildGmnPresetCardModel(keyOverview, fallbackMaskedKey = '') {
    return buildUsagePresetCardModel(keyOverview, fallbackMaskedKey);
  }

  function buildUsagePresetCardModel(keyOverview, fallbackMaskedKey = '', options = {}) {
    if (keyOverview?.usageKind === 'daily_usage_quota') {
      return buildDailyUsagePresetCardModel(keyOverview, fallbackMaskedKey);
    }

    if (keyOverview?.usageKind === 'chatgpt_rate_limit') {
      return buildOpenAiUsagePresetCardModel(keyOverview);
    }

    if (keyOverview?.usageKind === 'openrouter_free_daily_estimate') {
      return buildOpenRouterFreeEstimatePresetCardModel(keyOverview, fallbackMaskedKey);
    }

    if (options.providerId === 'openai' && !keyOverview) {
      return buildOpenAiUnavailablePresetCardModel();
    }

    if (options.providerId === 'quan2go' && !keyOverview) {
      return buildQuan2GoUnavailablePresetCardModel();
    }

    const quotaModel = buildGmnQuotaCardModel(keyOverview);
    const rawStatus = typeof keyOverview?.status === 'string' ? keyOverview.status.trim() : '';
    const statusText = rawStatus ? rawStatus.toUpperCase() : 'SYNCING';

    return {
      keyText: keyOverview?.maskedKey || fallbackMaskedKey || 'Unavailable',
      remainingText: quotaModel.remainingText,
      totalText: quotaModel.totalText,
      progressLabelText: 'Quota Left',
      progressPercent: quotaModel.progressPercent,
      progressText: quotaModel.progressText,
      progressDetailText: quotaModel.progressDetailText,
      progressGradient: quotaModel.progressGradient,
      progressItems: [
        buildPresetProgressItem({
          labelText: 'Quota Left',
          progressPercent: quotaModel.progressPercent,
          progressText: quotaModel.progressText,
          progressDetailText: quotaModel.progressDetailText,
          progressGradient: quotaModel.progressGradient
        })
      ],
      statusText
    };
  }

  return {
    buildUsagePresetCardModel,
    buildUsageQuotaCardModel,
    buildGmnPresetCardModel,
    buildGmnQuotaCardModel,
    buildProgressGradient,
    formatUsd
  };
});
