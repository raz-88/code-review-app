const Groq = require('groq-sdk');
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function test() {
  console.log('Testing Groq API...');

  const result = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: 'Say hello in one sentence' }],
    max_tokens: 100
  });

  console.log('Success! Response:', result.choices[0].message.content);
}

test();