const API_URL = 'https://little-heart-9411.sedasahingultekin.workers.dev';

async function apiPost(payload) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return await response.json();
}
