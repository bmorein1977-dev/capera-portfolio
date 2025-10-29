import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = d => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

router.get('/', async (req, res) => {
  const { course_id, from, to, language, lat, lon, radius_km } = req.query;
  const cond = [];
  const vals = [];
  let i = 1;

  if (course_id) { cond.push(`s.course_id = $${i}`); vals.push(course_id); i++; }
  if (from) { cond.push(`s.start_at >= $${i}`); vals.push(from); i++; }
  if (to) { cond.push(`s.start_at < $${i}`); vals.push(to); i++; }
  if (language) { cond.push(`s.language = $${i}`); vals.push(language); i++; }

  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  const sql = `
    SELECT s.*, v.name as venue_name, v.city, v.country, v.lat, v.lon
    FROM training_sessions s
    LEFT JOIN venues v ON s.venue_id = v.id
    ${where}
    ORDER BY s.start_at ASC
    LIMIT 300
  `;
  const { rows } = await pool.query(sql, vals);

  let filtered = rows;
  if (lat && lon && radius_km) {
    const la = parseFloat(lat), lo = parseFloat(lon), r = parseFloat(radius_km);
    filtered = rows
      .map(rw => ({
        ...rw,
        distance_km: (rw.lat && rw.lon) ? haversineKm(la, lo, rw.lat, rw.lon) : null
      }))
      .filter(rw => rw.distance_km === null || rw.distance_km <= r)
      .sort((a,b) => {
        if (a.distance_km == null && b.distance_km == null) return 0;
        if (a.distance_km == null) return 1;
        if (b.distance_km == null) return -1;
        return a.distance_km - b.distance_km;
      });
  }

  res.json(filtered);
});

export default router;
