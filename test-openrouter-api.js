// Test script for OpenRouter API key
const API_KEY = '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';
const CHAT_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const AUTH_API_URL = 'https://openrouter.ai/api/v1/auth/key';

async function testOpenRouterAPI() {
  console.log('Testing OpenRouter API key...\n');
  console.log('API Key (first 20 chars):', API_KEY.substring(0, 20) + '...\n');
  
  // First, try to verify the key by checking auth endpoint
  console.log('Step 1: Verifying API key with auth endpoint...');
  try {
    const authResponse = await fetch(AUTH_API_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    });
    
    const authData = await authResponse.json();
    console.log('Auth endpoint status:', authResponse.status);
    if (authResponse.ok) {
      console.log('✅ API key is valid!');
      console.log('Key info:', JSON.stringify(authData, null, 2));
    } else {
      console.log('Auth response:', JSON.stringify(authData, null, 2));
    }
  } catch (error) {
    console.log('Auth endpoint test failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Then try a chat completion
  console.log('Step 2: Testing chat completion endpoint...');
  
  const requestBody = {
    model: 'anthropic/claude-sonnet-4.5',
    messages: [
      {
        role: 'user',
        content: 'Say "Hello! The API key is working correctly." in exactly those words.'
      }
    ],
    max_tokens: 100
  };

  try {
    console.log('Making request to OpenRouter API...');
    console.log('Model:', requestBody.model);
    console.log('Message:', requestBody.messages[0].content);
    console.log('');

    const response = await fetch(CHAT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'HTTP-Referer': 'https://chartsmith.ai',
        'X-Title': 'ChartSmith'
      },
      body: JSON.stringify(requestBody)
    });

    const responseText = await response.text();
    console.log('Response Status:', response.status, response.statusText);
    console.log('');

    if (!response.ok) {
      console.error('❌ API call failed!');
      console.error('Response body:', responseText);
      
      try {
        const errorData = JSON.parse(responseText);
        console.error('\nError details:');
        console.error(JSON.stringify(errorData, null, 2));
        
        if (errorData.error) {
          console.error('\nPossible issues:');
          if (errorData.error.code === 401) {
            console.error('- The API key is invalid or expired');
            console.error('- The API key may not have been activated');
            console.error('- Check your OpenRouter dashboard to verify the key');
          }
        }
      } catch (e) {
        // Not JSON, already printed
      }
      return;
    }

    const data = JSON.parse(responseText);
    
    if (data.choices && data.choices.length > 0) {
      const content = data.choices[0].message.content;
      console.log('✅ API key is valid and working!');
      console.log('');
      console.log('Response from model:');
      console.log(content);
      console.log('');
      console.log('Full response metadata:');
      console.log('- Model used:', data.model || 'N/A');
      console.log('- Finish reason:', data.choices[0].finish_reason || 'N/A');
      if (data.usage) {
        console.log('- Tokens used:', data.usage.total_tokens || 'N/A');
        console.log('  - Prompt tokens:', data.usage.prompt_tokens || 'N/A');
        console.log('  - Completion tokens:', data.usage.completion_tokens || 'N/A');
      }
    } else {
      console.error('❌ Unexpected response format');
      console.error('Response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ Error testing API key:');
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

testOpenRouterAPI();

