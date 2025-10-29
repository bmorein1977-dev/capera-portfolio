import React, { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

function SmartOptions({ roleId, onPick }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);

  async function getOptions() {
    setLoading(true);
    const res = await fetch(`${API}/ai/recommend`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        user_id: 'demo-user',
        role_id: roleId,
        location: { }, // set {lat, lon, radius_km}
        date_window: {}
      })
    });
    const data = await res.json();
    setItems(data);
    setLoading(false);
  }

  return (
    <div style={{border:'1px solid #ddd', padding:12, borderRadius:8, marginTop:16}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <strong>Smart Options</strong>
        <button onClick={getOptions} disabled={loading}>{loading ? 'Loading...' : 'Get suggestions'}</button>
      </div>
      <ul>
        {items.map(it => (
          <li key={it.session_id} style={{margin:'12px 0', padding:8, border:'1px solid #eee', borderRadius:6}}>
            <div><strong>{it.title}</strong> — {new Date(it.start_at).toLocaleString()}</div>
            <div>{it.city || ''} {it.country || ''} · Seats: {it.seats_remaining}/{it.capacity}</div>
            <div style={{fontSize:12, opacity:0.8}}>{it.rationale}</div>
            <button onClick={() => onPick(it.session_id)} style={{marginTop:8}}>Request/Book</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function App() {
  const [courses, setCourses] = useState([]);
  const [roleId, setRoleId] = useState('');

  useEffect(() => {
    (async () => {
      const res = await fetch(`${API}/courses`);
      const data = await res.json();
      setCourses(data);
    })();
  }, []);

  async function book(sessionId) {
    const res = await fetch(`${API}/bookings`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ user_id:'demo-user', session_id: sessionId, role_id: roleId })
    });
    const data = await res.json();
    alert('Booking created with status: ' + data.booking.status);
  }

  return (
    <div style={{maxWidth:900, margin:'40px auto', fontFamily:'Inter, system-ui, Arial'}}>
      <h1>Training Catalogue</h1>
      <p>Pick a course to view sessions and try the Smart Options assistant.</p>

      <label>Role ID (for policy): </label>
      <input value={roleId} onChange={e=>setRoleId(e.target.value)} placeholder="Paste seeded role UUID…" style={{width:'60%'}} />

      <div>
        {courses.map(c => (
          <details key={c.id} style={{margin:'16px 0', padding:12, border:'1px solid #eee', borderRadius:8}}>
            <summary><strong>{c.title}</strong> — {c.modality} · €{c.cost}</summary>
            <p>{c.description}</p>
            <CourseSessions courseId={c.id} onBook={book} />
          </details>
        ))}
      </div>

      <SmartOptions roleId={roleId} onPick={book} />
    </div>
  );
}

function CourseSessions({ courseId, onBook }) {
  const [sessions, setSessions] = useState([]);
  useEffect(() => {
    (async () => {
      const res = await fetch(`${API}/sessions?course_id=${courseId}`);
      const data = await res.json();
      setSessions(data);
    })();
  }, [courseId]);
  return (
    <ul>
      {sessions.map(s => (
        <li key={s.id} style={{margin:'8px 0'}}>
          {new Date(s.start_at).toLocaleString()} — {s.venue_name || 'Virtual'} ({s.city || ''} {s.country || ''}) · Seats {s.seats_remaining}/{s.capacity}
          <button onClick={() => onBook(s.id)} style={{marginLeft:8}}>Book</button>
        </li>
      ))}
    </ul>
  );
}
