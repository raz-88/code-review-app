const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');
require('dotenv').config();

const app = express();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.post('/review', async (req, res) => {
  const { code, language, level } = req.body;

  if (!code || code.trim() === '') {
    return res.status(400).json({ error: 'No code provided' });
  }

  try {
    const result = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      messages: [{ role: 'user', content: buildPrompt(code, language, level) }]
    });

    const feedback = result.choices[0].message.content;
    res.json({ feedback });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI review failed. Try again.' });
  }
});

function buildPrompt(code, language, level = 'beginner') {
  return `You are a patient and encouraging coding tutor.
A ${level} student has submitted this ${language} code for review.

Respond in exactly this format:

## Bugs found
List each bug and explain WHY it is wrong in simple terms a ${level} can understand. If no bugs, write "No bugs found!".

## Fixed code
\`\`\`${language}
(paste the corrected code here)
\`\`\`

## Tips to improve
Give 2-3 short tips appropriate for a ${level} level student.

Student's code:
\`\`\`${language}
${code}
\`\`\``;
}

app.listen(process.env.PORT, () => {
  console.log(`Server running at http://localhost:${process.env.PORT}`);
});