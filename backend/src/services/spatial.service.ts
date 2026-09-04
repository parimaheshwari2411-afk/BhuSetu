import { queryDatabase } from "../utils/database";
import { ISpatialValidationResult, IGeometryInput } from "../types";

class SpatialService {
  /**
   * Validate polygon geometry and check for overlaps with existing parcels
   */
  async validateAndCheckOverlap(
    geometry: IGeometryInput,
    excludeParcelId?: string
  ): Promise<ISpatialValidationResult> {
    const result: ISpatialValidationResult = {
      isValid: false,
      topologyValid: false,
      areaInSqMeters: 0,
      intersectingParcels: [],
      errors: [],
    };

    try {
      // Convert GeoJSON to WKT format
      const wkt = this.geojsonToWkt(geometry);

      // 1. Validate topology
      const topologyCheck = await queryDatabase(
        `SELECT ST_IsValid($1::geometry) as is_valid, 
                ST_IsValidReason($1::geometry) as reason`,
        [wkt]
      );

      result.topologyValid = topologyCheck.rows[0].is_valid;

      if (!result.topologyValid) {
        result.errors.push(
          `Topology error: ${topologyCheck.rows[0].reason}`
        );
        return result;
      }

      // 2. Calculate area
      const areaCheck = await queryDatabase(
        `SELECT ST_Area($1::geometry) / 10000.0 as area_sq_meters`,
        [wkt]
      );

      result.areaInSqMeters = parseFloat(
        areaCheck.rows[0].area_sq_meters
      );

      // 3. Check for overlapping parcels
      let intersectionQuery = `
        SELECT id, ulpin FROM land_parcels 
        WHERE ST_Intersects(geometry, $1::geometry)
        AND ST_Overlaps(geometry, $1::geometry) = true
      `;

      const queryParams: any[] = [wkt];

      if (excludeParcelId) {
        intersectionQuery += ` AND id != $2`;
        queryParams.push(excludeParcelId);
      }

      const intersectionCheck = await queryDatabase(
        intersectionQuery,
        queryParams
      );

      result.intersectingParcels = intersectionCheck.rows.map(
        (row: any) => row.id
      );

      if (result.intersectingParcels.length > 0) {
        result.errors.push(
          `Land overlap detected with parcels: ${result.intersectingParcels.join(", ")}`
        );
        result.isValid = false;
      } else {
        result.isValid = true;
      }

      return result;
    } catch (error) {
      console.error("Spatial validation error:", error);
      result.errors.push("Spatial validation failed");
      return result;
    }
  }

  /**
   * Find all parcels within a bounding box
   */
  async findParcelsInBbox(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    limit: number = 100
  ): Promise<any[]> {
    try {
      const bbox = `POLYGON((${minX} ${minY}, ${maxX} ${minY}, ${maxX} ${maxY}, ${minX} ${maxY}, ${minX} ${minY}))`;

      const result = await queryDatabase(
        `SELECT id, ulpin, owner_id, 
                ST_AsGeoJSON(geometry) as geometry,
                area_in_sq_meters,
                location
         FROM land_parcels
         WHERE ST_Intersects(geometry, $1::geometry)
         LIMIT $2`,
        [bbox, limit]
      );

      return result.rows;
    } catch (error) {
      console.error("Find parcels in bbox error:", error);
      throw error;
    }
  }

  /**
   * Find nearest parcels to a point
   */
  async findNearestParcels(
    longitude: number,
    latitude: number,
    radiusMeters: number = 1000,
    limit: number = 10
  ): Promise<any[]> {
    try {
      const point = `POINT(${longitude} ${latitude})`;

      const result = await queryDatabase(
        `SELECT id, ulpin, owner_id,
                ST_AsGeoJSON(geometry) as geometry,
                area_in_sq_meters,
                ST_Distance(geometry, $1::geometry) as distance
         FROM land_parcels
         WHERE ST_DWithin(geometry, $1::geometry, $2)
         ORDER BY distance
         LIMIT $3`,
        [point, radiusMeters, limit]
      );

      return result.rows;
    } catch (error) {
      console.error("Find nearest parcels error:", error);
      throw error;
    }
  }

  /**
   * Calculate area between two parcels
   */
  async calculateIntersectionArea(
    parcelId1: string,
    parcelId2: string
  ): Promise<number> {
    try {
      const result = await queryDatabase(
        `SELECT ST_Area(ST_Intersection(
          (SELECT geometry FROM land_parcels WHERE id = $1),
          (SELECT geometry FROM land_parcels WHERE id = $2)
        )) as intersection_area`,
        [parcelId1, parcelId2]
      );

      return result.rows[0].intersection_area || 0;
    } catch (error) {
      console.error("Calculate intersection area error:", error);
      return 0;
    }
  }

  /**
   * Get all parcels as GeoJSON FeatureCollection
   */
  async getAllParcelsGeoJSON(limit: number = 1000): Promise<any> {
    try {
      const result = await queryDatabase(
        `SELECT jsonb_build_object(
          'type', 'FeatureCollection',
          'features', jsonb_agg(jsonb_build_object(
            'type', 'Feature',
            'id', id,
            'properties', jsonb_build_object(
              'ulpin', ulpin,
              'owner_id', owner_id,
              'area_sq_meters', area_in_sq_meters,
              'location', location,
              'created_at', created_at
            ),
            'geometry', ST_AsGeoJSON(geometry)::jsonb
          ))
        ) as geojson
        FROM (SELECT * FROM land_parcels LIMIT $1) as parcels`,
        [limit]
      );

      return result.rows[0].geojson;
    } catch (error) {
      console.error("Get parcels GeoJSON error:", error);
      throw error;
    }
  }

  /**
   * Get parcel by ID as GeoJSON
   */
  async getParcelGeoJSON(parcelId: string): Promise<any> {
    try {
      const result = await queryDatabase(
        `SELECT jsonb_build_object(
          'type', 'Feature',
          'id', id,
          'properties', jsonb_build_object(
            'ulpin', ulpin,
            'owner_id', owner_id,
            'area_sq_meters', area_in_sq_meters,
            'location', location,
            'document_ipfs_cid', document_ipfs_cid,
            'blockchain_hash', blockchain_hash,
            'created_at', created_at
          ),
          'geometry', ST_AsGeoJSON(geometry)::jsonb
        ) as geojson
        FROM land_parcels
        WHERE id = $1`,
        [parcelId]
      );

      return result.rows[0]?.geojson || null;
    } catch (error) {
      console.error("Get parcel GeoJSON error:", error);
      throw error;
    }
  }

  /**
   * Convert GeoJSON to WKT (Well-Known Text)
   */
  private geojsonToWkt(geometry: IGeometryInput): string {
    if (geometry.type !== "Polygon") {
      throw new Error("Only Polygon geometry is supported");
    }

    const coordinates = geometry.coordinates[0]
      .map((coord: number[]) => `${coord[0]} ${coord[1]}`)
      .join(", ");

    return `POLYGON((${coordinates}))`;
  }

  /**
   * Create spatial index on land_parcels table
   */
  async createSpatialIndex(): Promise<void> {
    try {
      await queryDatabase(
        `CREATE INDEX IF NOT EXISTS idx_land_parcels_geometry 
         ON land_parcels USING GIST (geometry)`
      );

      console.log("Spatial index created successfully");
    } catch (error) {
      console.error("Create spatial index error:", error);
    }
  }
}

export const spatialService = new SpatialService();
