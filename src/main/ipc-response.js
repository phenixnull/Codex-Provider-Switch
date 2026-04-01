function serializeError(error) {
  return {
    message: error?.message || 'Unknown error',
    code: error?.code || '',
    status: error?.status || 0,
    endpoint: error?.endpoint || '',
    model: error?.model || '',
    providerId: error?.providerId || '',
    responseId: error?.responseId || '',
    outputText: error?.outputText || ''
  };
}

async function runIpcTask(task) {
  try {
    const data = await task();
    return {
      ok: true,
      data
    };
  } catch (error) {
    return {
      ok: false,
      error: serializeError(error)
    };
  }
}

module.exports = {
  runIpcTask,
  serializeError
};
