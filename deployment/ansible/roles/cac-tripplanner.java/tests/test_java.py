def test_java_exists(Command):
    version_result = Command("java -version")

    assert version_result.rc == 0


def test_java_certs_exist(File):
    assert File("/etc/ssl/certs/java/cacerts").exists
