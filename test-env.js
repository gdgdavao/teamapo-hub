import dotenv from 'dotenv';

dotenv.config();

console.log('🔍 Environment Variable Test:');
console.log('GEMINI_API:', process.env.GEMINI_API ? '✅ SET' : '❌ NOT SET');

if (process.env.GEMINI_API) {
  console.log('Length:', process.env.GEMINI_API.length);
  console.log('Value starts with:', process.env.GEMINI_API.substring(0, 10) + '...');
  console.log('Value ends with:', '...' + process.env.GEMINI_API.substring(process.env.GEMINI_API.length - 10));
} else {
  console.log('💡 Make sure your .env file contains: GEMINI_API=your_actual_api_key');
}
