import configparser


def read_file(file_name):
    """Reads an entire file and returns it as a string

    Arguments
    :param file_name: A path to a file
    """
    with open(file_name, 'r') as f:
        return f.read()


def get_config(cac_config_path, profile):
    """Gets an AWS config Dict

    Arguments
    :param cac_config_path: Path to the config file
    :param profile: Config profile to read
    """
    cac_config = configparser.ConfigParser()
    cac_config.optionxform = str
    cac_config.read(cac_config_path)
    return {k: v.strip('"').strip("'") for k, v in cac_config.items(profile)}
