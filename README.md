# Bomberman .io game

## Networking

https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html

## Client states

```
[menu]
  |
  V
[waiting]
  |
  V
[playing]->(back to menu or waiting)

```

## Server states

```
[waiting]
    |
    |
    V
[playing]
    |
    |
    V
[game over]---->(back to waiting)


```

## TODO

 - Show player names.
 - Have game start after three people join.
 - Add HUD with points.
 - Only send blocks occasionally.
 - Expose render budget
