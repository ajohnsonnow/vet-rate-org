# ladder-radeon-25

## no-paint (stress condition)

The probe page never paints (a static page, no animation). This is a stress condition that reproduces the first version of the probe; on Windows it alone decides whether a long generation ends in DXGI_ERROR_DEVICE_HUNG. It is not what a user sees.

| Adapter                 | Model                             | Run | Page: painting (fps) / foreground | Context window | Detector tier (gpuTier) | maxBufferSize | Loaded | Load s | 1st token s (short / long) | tok/s (short / long) | Peak dedicated MiB (delta) | Peak shared MiB (delta) | Crash / lost | App path agreed | Error |
| ----------------------- | --------------------------------- | --- | --------------------------------- | -------------- | ----------------------- | ------------- | ------ | ------ | -------------------------- | -------------------- | -------------------------- | ----------------------- | ------------ | --------------- | ----- |
| AMD Radeon(TM) Graphics | Qwen2.5-1.5B-Instruct-q4f16_1-MLC | 1   | -                                 | 8192           | desktop-high (high)     | 2147483648    | yes    | 3.4    | 2.05 / 64.04               | 5.9 / 5.7            | 446 (195)                  | 6028 (1728)             | no           | not run         |       |
