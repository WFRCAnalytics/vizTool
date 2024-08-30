import pandas as pd
import geopandas as gpd
import sys
import traceback
from shapely.geometry import LineString, MultiLineString
from shapely.ops import nearest_points

print("starting")

try:
    # Load the shapefile
    shapefile_gdf = gpd.read_file(r"E:\Github\vizTool\scripts\Add-New-Segments-To-GeoJson\intermediate\New-Segments.shp").set_crs(epsg=26912)

    # Load the existing GeoJSON file
    geojson_gdf = gpd.read_file(r"E:\Github\vizTool\_site\geo-data\segments_v901_TransitCorridors.geojson")

    shape_crs = shapefile_gdf.crs
    geojson_crs = geojson_gdf.crs

    # Drop fields 'A' and 'B' if they exist
    fields_to_drop = ['A', 'B']
    shapefile_gdf = shapefile_gdf.drop(columns=[field for field in fields_to_drop if field in shapefile_gdf.columns])

    # Dissolve the shapefile geometries by 'SEGID'
    shapefile_gdf = shapefile_gdf.dissolve(by='SEGID').reset_index()

    ## Ensure that no MultiLineString geometries exist
    #def convert_multilinestring_to_linestring(geom):
    #    if isinstance(geom, MultiLineString):
    #        # Convert MultiLineString to LineString by taking the longest line
    #        longest_line = max(geom.geoms, key=lambda line: line.length)
    #        return longest_line
    #    return geom
    #
    #shapefile_gdf['geometry'] = shapefile_gdf['geometry'].apply(convert_multilinestring_to_linestring)

    shapefile_latlong_gdf = shapefile_gdf.to_crs(epsg=4326)
    geojson_latlon_gdf = geojson_gdf.to_crs(epsg=4326)

    shapefile_latlong_gdf.to_file(r"E:\Github\vizTool\scripts\Add-New-Segments-To-GeoJson\intermediate\debug_shapefile.geojson", driver="GeoJSON")
    geojson_latlon_gdf.to_file(r"E:\Github\vizTool\scripts\Add-New-Segments-To-GeoJson\intermediate\debug_geojson.geojson", driver="GeoJSON")

    geojson_gdf = geojson_gdf.to_crs(shape_crs)

    # Identify fields that are in geojson_gdf but not in shapefile_gdf
    geojson_fields = geojson_gdf.columns
    shapefile_fields = shapefile_gdf.columns
    missing_fields = geojson_fields.difference(shapefile_fields)

    # Add missing fields to shapefile_gdf and set their values to NaN
    for field in missing_fields:
        shapefile_gdf[field] = pd.NA

    # Function to find the nearest polyline in gdf2 for each polyline in gdf1
    def find_nearest(row, gdf):
        # Calculate the distance between the current row's geometry and all geometries in gdf
        distances = gdf.geometry.distance(row.geometry)
        # Get the index of the nearest geometry in gdf
        nearest_index = distances.idxmin()
        # Return the nearest geometry and its attributes as a Series (using only the missing fields)
        return gdf.loc[nearest_index, missing_fields]

    # Create a DataFrame to hold the nearest field values
    nearest_values = shapefile_gdf.apply(lambda row: find_nearest(row, geojson_gdf), axis=1)

    # Assign the nearest field values to the corresponding fields in shapefile_gdf
    for field in missing_fields:
        shapefile_gdf[field] = nearest_values[field]

    print(shapefile_gdf.shape[0])
    print(geojson_gdf.shape[0])

    # Ensure both GeoDataFrames have the same CRS
    if shapefile_gdf.crs != geojson_gdf.crs:
        geojson_gdf = geojson_gdf.to_crs(shapefile_gdf.crs)

    # Combine the two GeoDataFrames
    combined_gdf = pd.concat([shapefile_gdf, geojson_gdf], ignore_index=True)

    print(combined_gdf.shape[0])

    # Reproject the combined GeoDataFrame to match the original shapefile CRS if necessary
    combined_gdf = combined_gdf.to_crs(shape_crs)

    # Calculate length in meters and convert to miles (1 meter = 0.000621371 miles)
    combined_gdf['DISTANCE'] = combined_gdf.geometry.length * 0.000621371

    # Reproject the combined GeoDataFrame to match the GeoJSON's CRS if necessary
    combined_gdf = combined_gdf.to_crs(geojson_crs)

    # Save the result to a new GeoJSON file
    combined_gdf.to_file(r"E:\Github\vizTool\scripts\Add-New-Segments-To-GeoJson\results\segments_v901_TransitCorridors_with_New.geojson", driver="GeoJSON")

    # Save shp for TDM
    combined_gdf.to_file(r"E:\Github\vizTool\scripts\Add-New-Segments-To-GeoJson\results\WFv901_Segments_with_New.shp")

except Exception as e:
    print("*** There was an error running this script - Check output logfile.")
    
    # Write the error to a file
    with open(r"E:\Github\vizTool\scripts\Add-New-Segments-To-GeoJson\error.txt", "w") as logFile:
        tb = sys.exc_info()[2]
        tbinfo = traceback.format_tb(tb)
        pymsg = "\nPYTHON ERRORS:\nTraceback info:\n" + "".join(tbinfo) + "\nError Info:\n" + str(e)
        logFile.write(pymsg)

    sys.exit(1)

print("done")