import dotenv from 'dotenv';

dotenv.config({ path: new URL('.env', import.meta.url) });
dotenv.config();

const { default: app } = await import('./src/app.js');
const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  console.log(`Adeeb Cash Flow is running at http://localhost:${port}`);
});
