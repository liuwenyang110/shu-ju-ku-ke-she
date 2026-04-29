const { createApp } = require('./app');

const app = createApp();
const PORT = 3000;

app.listen(PORT, () => {
  console.log('\nGrade system server started.');
  console.log(`Visit: http://localhost:${PORT}\n`);
});
