import fetch from 'node-fetch';

async function test() {
  console.log("Testing API...");

  // 1. Login
  console.log("1. Logging in...");
  const loginRes = await fetch('http://localhost:3000/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123456' })
  });
  
  let token = '';
  if (loginRes.ok) {
    const data = await loginRes.json();
    token = data.token;
    console.log("Login successful, token:", token.substring(0, 10) + '...');
  } else {
    // try admin/admin
    const loginRes2 = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin' })
    });
    if (loginRes2.ok) {
      const data = await loginRes2.json();
      token = data.token;
      console.log("Login successful (admin/admin), token:", token.substring(0, 10) + '...');
    } else {
      console.error("Login failed");
      return;
    }
  }

  // 2. Create template
  console.log("\n2. Creating template...");
  const createRes = await fetch('http://localhost:3000/api/templates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'Test Template',
      key: 'test_key_' + Date.now(),
      width: 100,
      height: 100,
      description: 'Test description',
      status: 1,
      image_opacity: 1,
      overlay_color: 'rgba(0,0,0,0.5)',
      overlay_gradient: '',
      overlay_opacity: 1
    })
  });

  let templateId = null;
  if (createRes.ok) {
    const data = await createRes.json();
    templateId = data.id;
    console.log("Create successful, id:", templateId);
  } else {
    const err = await createRes.json();
    console.error("Create failed:", err);
    return;
  }

  // 3. Update template
  console.log("\n3. Updating template...");
  const updateRes = await fetch(`http://localhost:3000/api/templates/${templateId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'Updated Template',
      key: 'test_key_' + Date.now(),
      width: 200,
      height: 200,
      description: 'Updated description',
      status: 1,
      image_opacity: 0.8,
      overlay_color: 'rgba(255,0,0,0.5)',
      overlay_gradient: '',
      overlay_opacity: 1
    })
  });

  if (updateRes.ok) {
    console.log("Update successful");
  } else {
    const err = await updateRes.json();
    console.error("Update failed:", err);
  }

  // 4. Delete template
  console.log("\n4. Deleting template...");
  const deleteRes = await fetch(`http://localhost:3000/api/templates/${templateId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (deleteRes.ok) {
    console.log("Delete successful");
  } else {
    const err = await deleteRes.json();
    console.error("Delete failed:", err);
  }
}

test();
