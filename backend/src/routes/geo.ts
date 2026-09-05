import { Router, Request, Response } from "express";
import indiaGeo from "../data/india-geo.json";

const router = Router();

router.get("/states", (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: indiaGeo.map((entry) => ({
      state: entry.state,
      code: entry.code,
      cityCount: entry.cities.length,
    })),
    timestamp: new Date(),
  });
});

router.get("/states/:state/cities", (req: Request, res: Response) => {
  const stateParam = decodeURIComponent(req.params.state);
  const entry = indiaGeo.find(
    (item) =>
      item.state.toLowerCase() === stateParam.toLowerCase() ||
      item.code.toLowerCase() === stateParam.toLowerCase()
  );

  if (!entry) {
    return res.status(404).json({
      success: false,
      error: "State not found",
      timestamp: new Date(),
    });
  }

  res.json({
    success: true,
    data: {
      state: entry.state,
      code: entry.code,
      cities: entry.cities,
    },
    timestamp: new Date(),
  });
});

router.get("/", (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: indiaGeo,
    timestamp: new Date(),
  });
});

export default router;
