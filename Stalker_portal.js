// ============================================
// Xtream to M3U Converter for work.dev
// Simple Version with Portal Add Form
// ============================================

// ============ CONFIG ============
const CONFIG = {
    USERNAME: 'xtream',
    PASSWORD: 'xtream@123',
    SESSION_TIMEOUT: 3600
};

// ============ SESSION ============
const sessions = new Map();

function createSession(user) {
    const token = crypto.randomUUID();
    sessions.set(token, { user, expiry: Date.now() + 3600000 });
    return token;
}

function validateSession(token) {
    const session = sessions.get(token);
    if (!session || Date.now() > session.expiry) {
        sessions.delete(token);
        return false;
    }
    return true;
}

// ============ STORAGE ============
const portals = new Map();
let selectedPortal = null;

// Default portal
portals.set('default', {
    id: 'default',
    name: 'Rolex OTT',
    url: 'http://rolexott.pro',
    username: '12341234',
    password: '12341234'
});
selectedPortal = portals.get('default');

// ============ MAIN HANDLER ============
addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    
    // Get session token
    const cookie = request.headers.get('Cookie') || '';
    const token = cookie.match(/token=([^;]+)/)?.[1];
    
    // Public: Login page
    if (path === '/login' || path === '/') {
        if (method === 'POST') return handleLogin(request);
        return new Response(getLoginPage(), { headers: { 'Content-Type': 'text/html' } });
    }
    
    // Check login
    if (!validateSession(token)) {
        return Response.redirect(`${url.origin}/login`, 302);
    }
    
    // Routes
    if (path === '/logout') {
        return new Response('Logged out', {
            status: 302,
            headers: { 
                'Location': '/login',
                'Set-Cookie': 'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
            }
        });
    }
    
    if (path === '/dashboard') {
        return new Response(getDashboardPage(url.origin), { 
            headers: { 'Content-Type': 'text/html' } 
        });
    }
    
    if (path === '/add-portal' && method === 'POST') {
        return handleAddPortal(request, url.origin);
    }
    
    if (path === '/select-portal' && method === 'POST') {
        return handleSelectPortal(request, url.origin);
    }
    
    if (path === '/delete-portal' && method === 'POST') {
        return handleDeletePortal(request, url.origin);
    }
    
    if (path === '/playlist.m3u') {
        return generatePlaylist(url.origin);
    }
    
    if (path.match(/\/play\/\d+\.m3u8$/)) {
        return handleStream(request);
    }
    
    return new Response('404 Not Found', { status: 404 });
}

// ============ HANDLERS ============

async function handleLogin(request) {
    const form = await request.formData();
    if (form.get('username') === CONFIG.USERNAME && form.get('password') === CONFIG.PASSWORD) {
        const token = createSession('user');
        return new Response('OK', {
            status: 302,
            headers: {
                'Location': '/dashboard',
                'Set-Cookie': `token=${token}; Path=/; Max-Age=3600`
            }
        });
    }
    return new Response(getLoginPage('Invalid credentials'), { 
        headers: { 'Content-Type': 'text/html' } 
    });
}

async function handleAddPortal(request, origin) {
    const form = await request.formData();
    const id = crypto.randomUUID();
    
    portals.set(id, {
        id: id,
        name: form.get('name'),
        url: form.get('url'),
        username: form.get('username'),
        password: form.get('password')
    });
    
    if (!selectedPortal) selectedPortal = portals.get(id);
    
    return Response.redirect(`${origin}/dashboard`, 302);
}

async function handleSelectPortal(request, origin) {
    const form = await request.formData();
    selectedPortal = portals.get(form.get('id'));
    return Response.redirect(`${origin}/dashboard`, 302);
}

async function handleDeletePortal(request, origin) {
    const form = await request.formData();
    portals.delete(form.get('id'));
    
    if (selectedPortal?.id === form.get('id')) {
        selectedPortal = portals.size > 0 ? Array.from(portals.values())[0] : null;
    }
    
    return Response.redirect(`${origin}/dashboard`, 302);
}

async function generatePlaylist(origin) {
    if (!selectedPortal) {
        return new Response('# No portal selected', { 
            headers: { 'Content-Type': 'audio/x-mpegurl' } 
        });
    }
    
    const p = selectedPortal;
    const url = `${p.url}/player_api.php?username=${p.username}&password=${p.password}&action=get_live_streams`;
    
    try {
        const res = await fetch(url);
        const streams = await res.json();
        
        let m3u = '#EXTM3U\n';
        m3u += `#PLAYLIST: ${p.name}\n\n`;
        
        streams.slice(0, 100).forEach(s => {
            m3u += `#EXTINF:-1 tvg-id="${s.stream_id}" group-title="Live",${s.name}\n`;
            m3u += `${origin}/play/${s.stream_id}.m3u8\n`;
        });
        
        return new Response(m3u, {
            headers: { 'Content-Type': 'audio/x-mpegurl' }
        });
    } catch (e) {
        return new Response('# Error fetching streams', { 
            headers: { 'Content-Type': 'audio/x-mpegurl' } 
        });
    }
}

async function handleStream(request) {
    const id = request.url.match(/\/play\/(\d+)\.m3u8$/)?.[1];
    if (!id || !selectedPortal) return new Response('Error', { status: 400 });
    
    const p = selectedPortal;
    const url = `${p.url}/live/${p.username}/${p.password}/${id}.m3u8`;
    
    const res = await fetch(url);
    const content = await res.text();
    
    return new Response(content, {
        headers: { 'Content-Type': 'application/vnd.apple.mpegurl' }
    });
}

// ============ HTML PAGES ============

function getLoginPage(error = '') {
    return `<!DOCTYPE html>
<html>
<head>
    <title>Login</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 20px;
        }
        .box {
            background: white;
            border-radius: 10px;
            padding: 40px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 15px 35px rgba(0,0,0,0.2);
        }
        h2 { text-align: center; color: #333; margin-bottom: 30px; }
        input {
            width: 100%;
            padding: 12px;
            margin: 10px 0;
            border: 2px solid #e0e0e0;
            border-radius: 6px;
            box-sizing: border-box;
        }
        button {
            width: 100%;
            padding: 14px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            cursor: pointer;
            margin-top: 20px;
        }
        .error { color: red; text-align: center; margin-bottom: 15px; }
    </style>
</head>
<body>
    <div class="box">
        <h2>Xtream to M3U</h2>
        ${error ? `<div class="error">${error}</div>` : ''}
        <form method="POST">
            <input type="text" name="username" placeholder="Username" value="xtream" required>
            <input type="password" name="password" placeholder="Password" value="xtream@123" required>
            <button type="submit">Login</button>
        </form>
    </div>
</body>
</html>`;
}

function getDashboardPage(origin) {
    const portalList = Array.from(portals.values()).map(p => `
        <option value="${p.id}" ${selectedPortal?.id === p.id ? 'selected' : ''}>
            ${p.name}
        </option>
    `).join('');
    
    return `<!DOCTYPE html>
<html>
<head>
    <title>Dashboard</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            margin: 0;
            padding: 20px;
        }
        .container { max-width: 800px; margin: 0 auto; }
        .card {
            background: white;
            border-radius: 10px;
            padding: 25px;
            margin-bottom: 20px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        h2 { color: #333; margin-top: 0; }
        .flex { display: flex; gap: 10px; margin: 15px 0; }
        input, select {
            flex: 1;
            padding: 12px;
            border: 2px solid #e0e0e0;
            border-radius: 6px;
        }
        button {
            padding: 12px 20px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
        }
        .btn-red { background: #f56565; }
        .btn-green { background: #48bb78; }
        .url-box {
            background: #f7f7f7;
            padding: 15px;
            border-radius: 6px;
            word-break: break-all;
            margin: 15px 0;
        }
        .portal-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            margin: 10px 0;
        }
        .logout {
            text-align: right;
            margin-bottom: 20px;
        }
        .logout a {
            color: white;
            text-decoration: none;
            background: rgba(255,255,255,0.2);
            padding: 8px 15px;
            border-radius: 6px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logout">
            <a href="/logout">Logout</a>
        </div>
        
        <!-- Add Portal Form -->
        <div class="card">
            <h2>➕ Add New Portal</h2>
            <form method="POST" action="/add-portal">
                <input type="text" name="name" placeholder="Portal Name" required>
                <input type="url" name="url" placeholder="URL (e.g., http://rolexott.pro)" required>
                <input type="text" name="username" placeholder="Username" required>
                <input type="text" name="password" placeholder="Password" required>
                <button type="submit">Add Portal</button>
            </form>
        </div>
        
        <!-- Select Portal -->
        ${portals.size > 0 ? `
        <div class="card">
            <h2>📡 Select Portal</h2>
            <form method="POST" action="/select-portal" class="flex">
                <select name="id">
                    ${portalList}
                </select>
                <button type="submit">Switch</button>
            </form>
        </div>
        ` : ''}
        
        <!-- Current Portal -->
        ${selectedPortal ? `
        <div class="card">
            <h2>✅ Active: ${selectedPortal.name}</h2>
            <p>URL: ${selectedPortal.url}<br>User: ${selectedPortal.username}</p>
            
            <div class="url-box">
                <strong>Playlist URL:</strong><br>
                ${origin}/playlist.m3u
            </div>
            
            <div class="flex">
                <a href="${origin}/playlist.m3u" style="flex:1">
                    <button style="width:100%">📥 Download</button>
                </a>
                <button onclick="copyUrl()" style="flex:1">📋 Copy URL</button>
            </div>
        </div>
        ` : ''}
        
        <!-- All Portals -->
        <div class="card">
            <h2>📋 All Portals</h2>
            ${Array.from(portals.values()).map(p => `
                <div class="portal-item">
                    <div>
                        <strong>${p.name}</strong><br>
                        <small>${p.url}</small>
                    </div>
                    <div class="flex">
                        ${selectedPortal?.id !== p.id ? `
                        <form method="POST" action="/select-portal">
                            <input type="hidden" name="id" value="${p.id}">
                            <button class="btn-green" type="submit">Select</button>
                        </form>
                        ` : '<span style="color:#667eea">✓ Selected</span>'}
                        <form method="POST" action="/delete-portal" onsubmit="return confirm('Delete?')">
                            <input type="hidden" name="id" value="${p.id}">
                            <button class="btn-red" type="submit">Delete</button>
                        </form>
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
    
    <script>
        function copyUrl() {
            const url = '${origin}/playlist.m3u';
            navigator.clipboard.writeText(url);
            alert('URL copied!');
        }
    </script>
</body>
</html>`;
}

// ============ END ============
