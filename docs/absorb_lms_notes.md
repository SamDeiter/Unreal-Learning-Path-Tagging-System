# Absorb LMS Integration Notes

## API Docs

- Main: <https://docs.myabsorb.com/integration-api/v2/docs>
- **Tags**: <https://docs.myabsorb.com/integration-api/v2/docs/tags>

## Authentication

Header: `X-API-Key: <private_key>` (from portal settings)

## Tags API (Key for our system!)

```
POST /tags    → Create: {"id": "string", "name": "string"}
GET /tags     → List all
PUT /tags/{id}→ Update
```

## Our Tag → Absorb Mapping

| Our canonical_tags | Absorb Tag Name |
|-------------------|-----------------|
| rendering.material | rendering.material |
| animation.general | animation.general |
| cinematic.sequencer | cinematic.sequencer |

## Data Mapping

| Our Field | Absorb Field |
|-----------|--------------|
| title | Course Name |
| canonical_tags | Tags (via Tags API) |
| difficulty | Custom Field |
| duration_minutes | Course Duration |
