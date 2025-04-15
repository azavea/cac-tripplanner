#!/usr/bin/env python
"""Modifies GTFS files to OTP v1 standard.

OTPv2 updates as GTFS standard updates, however not backported to OTPv1.
We can't migrate to OTPv2, so manually modify GTFS for OTPv1 support level.
"""
import logging
import zipfile
import csv
import os

logging.basicConfig()
LOG = logging.getLogger()
LOG.setLevel(logging.INFO)

gtfs_dir = 'gtfs'

def unzip_file(filename):
    feed_path = gtfs_dir + "/" + filename + ".zip"
    if zipfile.is_zipfile(feed_path):
        with zipfile.ZipFile(feed_path, 'r') as zip_ref:
            zip_ref.extractall(gtfs_dir)
            LOG.debug('Unzipped %s', filename)
            return
    else:
        LOG.warn('File %s does not look like a valid zip file.', filename)

def clean_up_txt_files():
    for root, _, files in os.walk(gtfs_dir):
        for file in files:
            if file.endswith('.txt'):
                os.remove(os.path.join(root, file))
    LOG.debug('Cleaned up .txt files')

def re_zip_files(filename):
    feed_path = gtfs_dir + "/" + filename + ".zip"
    with zipfile.ZipFile(feed_path, 'w', zipfile.ZIP_DEFLATED) as zip_ref:
        for root, _, files in os.walk(gtfs_dir):
            for file in files:
                if file.endswith('.txt'):
                    file_path = os.path.join(root, file)
                    zip_ref.write(file_path, os.path.relpath(file_path, gtfs_dir))
        LOG.debug('Re-zipped %s', feed_path)

def modify_septa_bus():
    # New GTFS includes replacement trolleybuses, unsupported transit type in OTPv1
    # Convert to buses to prevent error building OTP
    # Reference: https://github.com/septadev/GTFS?tab=readme-ov-file#routestxt
    txt_path_to_update = os.path.join(gtfs_dir, 'routes.txt')
    column_to_update = 'route_type'
    new_route_type = '11'
    otpv1_supported_route_type = '3'
    try:
        updated_rows = []
        with open(txt_path_to_update, 'r') as csvfile:
            reader = csv.DictReader(csvfile)
            header = reader.fieldnames
            if column_to_update not in header:
                raise ValueError('Column %s not found in routes.txt', column_to_update)
            for row in reader:
                if row[column_to_update] == str(new_route_type):
                    row[column_to_update] = str(otpv1_supported_route_type)
                    LOG.info('Converted route_id {} from type {} to {}'.format(row['route_id'], new_route_type, otpv1_supported_route_type))
                updated_rows.append(row)

        with open(txt_path_to_update, 'w') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=header)
            writer.writeheader()
            writer.writerows(updated_rows)

        LOG.debug('Modified %s', txt_path_to_update)
    except Exception as e:
        raise ValueError('Error modifying {}: {}'.format(txt_path_to_update, e))

def main():
    filenames_to_modify = ['septa_bus']
    for filename in filenames_to_modify:
        unzip_file(filename)
        # Run modifications
        # Namely modify SEPTA bus GTFS for OTPv1 support level
        modify_septa_bus()
        # Clean up
        re_zip_files(filename)
        clean_up_txt_files()
    
    LOG.info('Updating GTFS feeds for OTPv1 support complete')

if __name__ == "__main__":
    main()
