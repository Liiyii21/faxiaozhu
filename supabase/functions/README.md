# Service analysis

Deploy `service-analysis` to your Supabase project. Uses existing server secret `VISION_API_KEY`, `VISION_API_BASE_URL=https://xjjuhe.site/v1`, and `VISION_MODEL=gpt-6.1-sol`. Never put the model key in the frontend. The browser submits POST JSON with page_id (legal or divination) and the corresponding issue or question/fortune. Upstream errors are shown as errors, without a simulated model result.
