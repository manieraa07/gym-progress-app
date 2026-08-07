<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>GymApp</title>
</head>
<body style="background: #030712; font-family: system-ui, -apple-system, sans-serif; padding: 16px; margin: 0;">

  <div id="mode-selection" style="max-width: 400px; margin: 40px auto; text-align: center; color: #fff;">
    <h1 style="font-size: 20px;">Kto dzisiaj trenuje?</h1>
    <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 20px;">
      <button onclick="window.startSession('martin_session')" style="padding: 16px; background: #2563eb; color: #fff; font-weight: bold; border: none; border-radius: 12px; cursor: pointer; font-size: 15px;">
        Martin (Wspólny Trening Góry)
      </button>
      <button onclick="window.startSession('ana_solo')" style="padding: 16px; background: #db2777; color: #fff; font-weight: bold; border: none; border-radius: 12px; cursor: pointer; font-size: 15px;">
        Ana Solo (Dół)
      </button>
    </div>
  </div>

  <div id="loading-screen" class="hidden" style="max-width: 400px; margin: 60px auto; text-align: center; color: #10b981; font-weight: bold;">
    Pobieranie ostatnich wyników z Firebase...
  </div>

  <div id="exercise-card-view" class="hidden" style="max-width: 400px; margin: 0 auto;">
    <div id="card-container"></div>
  </div>

  <script type="module" src="app.js"></script>
</body>
</html>
