function getUsageStatsTarget(productId) {
  if (productId === 'claude') {
    return {
      label: '查看额度',
      url: 'https://www.bigmodel.cn/usercenter/glm-coding/usage'
    };
  }

  return null;
}

module.exports = {
  getUsageStatsTarget
};
