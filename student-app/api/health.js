module.exports = (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Academia De San Jose API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
};
