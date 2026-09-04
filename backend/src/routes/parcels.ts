import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { queryDatabase } from "../utils/database";
import { spatialService } from "../services/spatial.service";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware";
import { IApiResponse, IPaginatedResponse, ILandParcel } from "../types";

const router = Router();

/**
 * POST /api/v1/parcels
 * Register new land parcel with spatial validation
 */
router.post(
  "/",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { ulpin, geometry, location, totalValue, documentIpfsCid } =
        req.body;
      const userId = req.user?.id;

      if (!ulpin || !geometry || !location || !userId) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields",
          timestamp: new Date(),
        });
      }

      // Validate and check overlaps
      const spatialValidation = await spatialService.validateAndCheckOverlap(
        geometry
      );

      if (!spatialValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: "Spatial validation failed",
          data: spatialValidation,
          timestamp: new Date(),
        });
      }

      // Insert land parcel
      const parcelId = uuidv4();
      const geojson = JSON.stringify(geometry);

      const result = await queryDatabase(
        `INSERT INTO land_parcels 
         (id, ulpin, owner_id, geometry, area_in_sq_meters, total_value, location, document_ipfs_cid)
         VALUES ($1, $2, $3, ST_GeomFromGeoJSON($4), $5, $6, $7, $8)
         RETURNING id, ulpin, owner_id, area_in_sq_meters, total_value, location, document_ipfs_cid, created_at`,
        [
          parcelId,
          ulpin,
          userId,
          geojson,
          spatialValidation.areaInSqMeters,
          totalValue || "0",
          JSON.stringify(location),
          documentIpfsCid || null,
        ]
      );

      const parcel = result.rows[0];

      const response: IApiResponse<Partial<ILandParcel>> = {
        success: true,
        data: {
          id: parcel.id,
          ulpin: parcel.ulpin,
          ownerId: parcel.owner_id,
          areaInSqMeters: parcel.area_in_sq_meters,
          totalValue: parcel.total_value,
          location: parcel.location,
          documentIpfsCid: parcel.document_ipfs_cid,
        },
        message: "Land parcel registered successfully",
        timestamp: new Date(),
      };

      res.status(201).json(response);
    } catch (error) {
      console.error("Create parcel error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to register land parcel",
        timestamp: new Date(),
      });
    }
  }
);

/**
 * GET /api/v1/parcels/:id
 * Get land parcel by ID
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await queryDatabase(
      `SELECT id, ulpin, owner_id, ST_AsGeoJSON(geometry) as geometry,
              area_in_sq_meters, total_value, location, document_ipfs_cid,
              blockchain_hash, created_at, updated_at
       FROM land_parcels WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Parcel not found",
        timestamp: new Date(),
      });
    }

    const parcel = result.rows[0];

    const response: IApiResponse<ILandParcel> = {
      success: true,
      data: {
        id: parcel.id,
        ulpin: parcel.ulpin,
        ownerId: parcel.owner_id,
        geometry: JSON.parse(parcel.geometry),
        areaInSqMeters: parcel.area_in_sq_meters,
        totalValue: parcel.total_value,
        location: parcel.location,
        documentIpfsCid: parcel.document_ipfs_cid,
        blockchainHash: parcel.blockchain_hash,
        createdAt: parcel.created_at,
        updatedAt: parcel.updated_at,
      },
      timestamp: new Date(),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Get parcel error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve parcel",
      timestamp: new Date(),
    });
  }
});

/**
 * GET /api/v1/parcels
 * Get all land parcels with pagination
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const offset = (page - 1) * pageSize;

    const countResult = await queryDatabase(
      "SELECT COUNT(*) as total FROM land_parcels"
    );
    const total = parseInt(countResult.rows[0].total);

    const result = await queryDatabase(
      `SELECT id, ulpin, owner_id, ST_AsGeoJSON(geometry) as geometry,
              area_in_sq_meters, total_value, location, document_ipfs_cid,
              blockchain_hash, created_at, updated_at
       FROM land_parcels
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    const parcels: ILandParcel[] = result.rows.map((row: any) => ({
      id: row.id,
      ulpin: row.ulpin,
      ownerId: row.owner_id,
      geometry: JSON.parse(row.geometry),
      areaInSqMeters: row.area_in_sq_meters,
      totalValue: row.total_value,
      location: row.location,
      documentIpfsCid: row.document_ipfs_cid,
      blockchainHash: row.blockchain_hash,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const response: IPaginatedResponse<ILandParcel> = {
      success: true,
      data: parcels,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
      timestamp: new Date(),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("List parcels error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve parcels",
      timestamp: new Date(),
    });
  }
});

/**
 * GET /api/v1/parcels/spatial
 * Get all parcels as GeoJSON for map rendering
 */
router.get("/spatial/geojson", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 1000;
    const geojson = await spatialService.getAllParcelsGeoJSON(limit);

    const response: IApiResponse = {
      success: true,
      data: geojson,
      timestamp: new Date(),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Get parcels GeoJSON error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve parcels GeoJSON",
      timestamp: new Date(),
    });
  }
});

/**
 * GET /api/v1/parcels/search/bbox
 * Find parcels within bounding box
 */
router.get("/search/bbox", async (req: Request, res: Response) => {
  try {
    const minX = parseFloat(req.query.minX as string);
    const minY = parseFloat(req.query.minY as string);
    const maxX = parseFloat(req.query.maxX as string);
    const maxY = parseFloat(req.query.maxY as string);
    const limit = parseInt(req.query.limit as string) || 100;

    if (isNaN(minX) || isNaN(minY) || isNaN(maxX) || isNaN(maxY)) {
      return res.status(400).json({
        success: false,
        error: "Invalid bounding box coordinates",
        timestamp: new Date(),
      });
    }

    const parcels = await spatialService.findParcelsInBbox(
      minX,
      minY,
      maxX,
      maxY,
      limit
    );

    const response: IApiResponse = {
      success: true,
      data: parcels,
      timestamp: new Date(),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Search by bbox error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to search parcels by bbox",
      timestamp: new Date(),
    });
  }
});

/**
 * GET /api/v1/parcels/search/nearest
 * Find nearest parcels to a point
 */
router.get("/search/nearest", async (req: Request, res: Response) => {
  try {
    const longitude = parseFloat(req.query.longitude as string);
    const latitude = parseFloat(req.query.latitude as string);
    const radiusMeters = parseInt(req.query.radius as string) || 1000;
    const limit = parseInt(req.query.limit as string) || 10;

    if (isNaN(longitude) || isNaN(latitude)) {
      return res.status(400).json({
        success: false,
        error: "Invalid coordinates",
        timestamp: new Date(),
      });
    }

    const parcels = await spatialService.findNearestParcels(
      longitude,
      latitude,
      radiusMeters,
      limit
    );

    const response: IApiResponse = {
      success: true,
      data: parcels,
      timestamp: new Date(),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Search nearest error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to search nearby parcels",
      timestamp: new Date(),
    });
  }
});

export default router;
