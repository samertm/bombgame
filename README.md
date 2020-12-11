# Bomberman .io game

## Networking

https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html

### Client Prediction

Client prediction works in the following way:

1. The input module stores keyboard inputs as an array.

2. On every game loop (every 1/60th of a second), we check the inputs
   array. If it's non empty, we retrieve it and wipe the buffer that
   the input module stores moves in.
   
3. We record the inputs along with the timestamp for the input.

4. Once we receive a server update, use that as the starting point and
   run "update" for all the timestamps after that point.
